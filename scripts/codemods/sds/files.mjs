// Which files the scanner reads and which ones a codemod may write.
//
// The scanner reads the UI code the sds/* rules govern (apps/mobile/app,
// apps/mobile/src, packages/sds/src) minus generated files and tests, so its
// counts line up with the lint record. A codemod writes a narrower set: it
// also skips every path in exclude.json (files a batch must not touch, each
// with its reason) and every file with uncommitted changes, which belong to
// someone's work in progress. Both are listed in the codemod's report.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { repoRoot } from './tokens.mjs';

export const SCAN_DIRS = ['apps/mobile/app', 'apps/mobile/src', 'packages/sds/src'];

/** Files in the scanned directories that are not UI code: generated pages, SVG data, tests. */
export const NOT_SCANNED = [
  /\.generated\.ts$/,
  /hssc\/map-svg\.constants\.ts$/,
  /readability\.injected\.ts$/,
  /\.test\.(m?ts|tsx)$/,
  /\.typetest\.tsx?$/,
  /__tests__\//,
];

const toPosix = (p) => p.split(sep).join('/');

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every scanned file, repository-relative in `/` form, sorted. */
export function scanFiles(root = repoRoot) {
  return SCAN_DIRS.flatMap((d) => walk(resolve(root, d), []))
    .map((p) => toPosix(relative(root, p)))
    .filter((f) => !NOT_SCANNED.some((re) => re.test(f)))
    .sort();
}

/** The `{ path, reason }` entries of exclude.json. */
export function excludeList(root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, 'scripts/codemods/sds/exclude.json'), 'utf8')).files;
}

/** Repository-relative paths with uncommitted changes (staged, unstaged or untracked). */
export function dirtyFiles(root = repoRoot) {
  const out = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...SCAN_DIRS], { cwd: root, encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git status failed: ${out.stderr}`);
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^.* -> /, ''));
}

/**
 * The files a codemod may write: `candidates` (default every scanned file)
 * minus exclude.json, minus files with uncommitted changes unless `allowDirty`.
 * Returns `{ files, skipped }`, `skipped` being `{ path, reason }`.
 */
export function writableFiles({ candidates, allowDirty = false, root = repoRoot } = {}) {
  const pool = candidates ?? scanFiles(root);
  const excluded = new Map(excludeList(root).map((e) => [e.path, e.reason]));
  const dirty = allowDirty ? new Set() : new Set(dirtyFiles(root));
  const files = [];
  const skipped = [];
  for (const f of pool) {
    if (excluded.has(f)) skipped.push({ path: f, reason: `exclude.json: ${excluded.get(f)}` });
    else if (dirty.has(f)) skipped.push({ path: f, reason: 'uncommitted changes (pass --allow-dirty for your own)' });
    else files.push(f);
  }
  return { files, skipped };
}
