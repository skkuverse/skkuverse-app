// `yarn test:gate <path>...` runs the test suites that own the given paths,
// each once: a path under a workspace (the root package.json `workspaces`)
// runs that workspace's `test` script, a path under the root `scripts/` runs
// `yarn test:repo`, a source the comment rules read runs `yarn test:comments`
// on it, a doc under `docs/` runs `yarn test:comments` over the tree, and any
// other path runs nothing.
//
// The Claude Code commit gate calls it with the paths a commit holds, so the
// commit pays for the suites it could have broken and CI runs the rest (`yarn test`).
// Paths are relative to the repository root, or absolute inside it.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isCommentScoped } from './architecture/comments/tree.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** The path relative to `root` in `/` form, or null when it lies outside. */
function toRelative(path, root) {
  const rel = relative(root, isAbsolute(path) ? path : resolve(root, path));
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

/**
 * The workspace directory owning `rel`, matching the root `workspaces`
 * patterns segment by segment (`*` is one segment), or null.
 */
function owningWorkspace(rel, patterns) {
  const segments = rel.split('/');
  for (const pattern of patterns) {
    const parts = pattern.replace(/\/+$/, '').split('/');
    if (segments.length <= parts.length) continue; // the directory itself owns no file
    if (parts.every((part, i) => part === '*' || part === segments[i])) {
      return segments.slice(0, parts.length).join('/');
    }
  }
  return null;
}

/**
 * The suites owning `paths`, deduplicated and ordered by owner (workspaces by
 * directory, then the root scripts). Each is `{ label, args }`, where `args`
 * is the yarn invocation.
 */
export function suitesFor(paths, root = repoRoot) {
  const rootManifest = readJson(resolve(root, 'package.json'));
  const patterns = rootManifest.workspaces ?? [];
  const owners = new Map();
  const commented = [];
  let docEdited = false;
  for (const path of paths) {
    const rel = toRelative(path, root);
    if (rel === null) continue;
    if (isCommentScoped(rel, new Set())) commented.push(rel);
    if (/^docs\/.*\.md$/.test(rel)) docEdited = true;
    if (rel.startsWith('scripts/')) {
      owners.set('~scripts', { label: 'test:repo', args: ['--silent', 'test:repo'] });
      continue;
    }
    const dir = owningWorkspace(rel, patterns);
    if (dir === null || owners.has(dir)) continue;
    const manifestPath = resolve(root, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (!manifest.name || !manifest.scripts?.test) continue;
    owners.set(dir, { label: manifest.name, args: ['--silent', 'workspace', manifest.name, 'test'] });
  }
  if (docEdited || commented.length > 0) {
    owners.set('~comments', { label: 'comments', args: ['--silent', 'test:comments', ...(docEdited ? [] : commented)] });
  }
  return [...owners.keys()].sort().map((key) => owners.get(key));
}

function main(paths) {
  if (paths.length === 0) {
    console.error('usage: yarn test:gate <path>...');
    return 2;
  }
  const suites = suitesFor(paths);
  if (suites.length === 0) {
    console.log('test:gate: no test suite owns the given paths');
    return 0;
  }
  // The gate quotes only the tail of this output. Piped, `node --test` reports
  // TAP with each failure inline; the spec reporter repeats the failures last.
  const env = {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--test-reporter=spec'].filter(Boolean).join(' '),
  };
  const failed = [];
  for (const suite of suites) {
    console.log(`test:gate: ${suite.label} (yarn ${suite.args.join(' ')})`);
    const result = spawnSync('yarn', suite.args, { cwd: repoRoot, stdio: 'inherit', env });
    if (result.error) console.error(`test:gate: could not run yarn: ${result.error.message}`);
    if (result.status !== 0) failed.push(suite);
  }
  if (failed.length > 0) {
    console.error(`test:gate: failed: ${failed.map((suite) => suite.label).join(', ')}`);
    for (const suite of failed) console.error(`test:gate: rerun with: yarn ${suite.args.join(' ')}`);
    return 1;
  }
  console.log(`test:gate: passed: ${suites.map((suite) => suite.label).join(', ')}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
