#!/usr/bin/env node
// Fails when a patch in patches/ is not applied to the package it patches in
// node_modules. Run from anywhere after `yarn install`:
//
//   node scripts/check-patches.mjs          # check
//   node scripts/check-patches.mjs --fix    # run patch-package, then check
//   node scripts/check-patches.mjs --root DIR
//
// The root `postinstall` runs patch-package, but yarn v1 runs only the
// lifecycle scripts of the manifest it was invoked for. `yarn add` or
// `yarn remove` inside a workspace (`yarn workspace mobile add x`, or
// `yarn add x` in apps/mobile) re-links node_modules, which restores every
// patched file from the cache, and never runs the root postinstall; a root
// `yarn remove` skips it too. On 2026-10-24 that left the tree without the
// bottom-sheet patch that fixes the TestFlight 3.6.2 scroll-lock crash.
// patch-package itself exits 0 on a patch that fails to apply unless CI is set.
//
// Each patch is checked with `git apply --check --reverse`, which needs no git
// repository: it succeeds only when every hunk is already in place.
//
// Exit 0 when every patch is applied, 1 when one is not.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = 'npx patch-package';

/** @typedef {'applied' | 'unapplied' | 'conflict' | 'not-installed' | 'version-mismatch'} PatchState */

/** What each state that is not `applied` means and how to leave it. */
const ADVICE = {
  unapplied: () => `not applied. Fix: ${FIX}`,
  conflict: (p) =>
    `neither applied nor applicable to the installed files. Fix: rm -rf node_modules/${p.name} && yarn install --frozen-lockfile`,
  'not-installed': (p) => `node_modules/${p.name} is not installed. Fix: yarn install --frozen-lockfile`,
  'version-mismatch': (p) =>
    `installed ${p.installed}, but the patch is for ${p.version}. Regenerate it for ${p.installed} (npx patch-package ${p.name}) in the same change as the bump`,
};

/**
 * `@scope+name+1.2.3.patch` → { name: '@scope/name', version: '1.2.3' }.
 * A nested (`a++b`) or sequenced patch-package name stops the check rather
 * than being skipped, since none exists here and each needs its own lookup.
 */
export function parsePatchName(file) {
  const parts = file.replace(/\.patch$/, '').split('+');
  if (parts.length < 2 || parts.includes('') || !/^\d/.test(parts.at(-1))) {
    throw new Error(`check-patches: unsupported patch file name "${file}"`);
  }
  return { name: parts.slice(0, -1).join('/'), version: parts.at(-1) };
}

function gitApplies(root, patchFile, reverse) {
  const args = ['apply', '--check', ...(reverse ? ['--reverse'] : []), patchFile];
  return spawnSync('git', args, { cwd: root, stdio: 'ignore' }).status === 0;
}

/** @returns {{ state: PatchState, installed?: string }} */
function stateOf(root, patchFile, { name, version }) {
  const manifest = path.join(root, 'node_modules', name, 'package.json');
  if (!fs.existsSync(manifest)) return { state: 'not-installed' };
  const installed = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  if (installed !== version) return { state: 'version-mismatch', installed };
  if (gitApplies(root, patchFile, true)) return { state: 'applied' };
  return { state: gitApplies(root, patchFile, false) ? 'unapplied' : 'conflict' };
}

export function checkPatches(root) {
  const dir = path.join(root, 'patches');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.patch')).sort() : [];
  return files.map((file) => {
    const parsed = parsePatchName(file);
    return { file, ...parsed, ...stateOf(root, path.join(dir, file), parsed) };
  });
}

function report(results) {
  const bad = results.filter((r) => r.state !== 'applied');
  if (bad.length === 0) {
    console.log(`check-patches: all ${results.length} patches in patches/ are applied.`);
    return 0;
  }
  console.error(`\n✗ check-patches: ${bad.length} of ${results.length} patches in patches/ are not in effect:`);
  for (const r of bad) console.error(`  ${r.file}: ${ADVICE[r.state](r)}`);
  console.error(
    '\nyarn v1 skips the root postinstall (patch-package) on a `yarn add` or `yarn remove` run' +
      ' inside a workspace, and on a root `yarn remove`.' +
      `\nApply them with: ${FIX}   (or: node scripts/check-patches.mjs --fix)\n`,
  );
  return 1;
}

function main(argv) {
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag === -1 ? REPO_ROOT : path.resolve(argv[rootFlag + 1]);
  if (argv.includes('--fix')) {
    const bin = path.join(root, 'node_modules', '.bin', 'patch-package');
    spawnSync(bin, ['--error-on-fail'], { cwd: root, stdio: 'inherit' });
  }
  return report(checkPatches(root));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
