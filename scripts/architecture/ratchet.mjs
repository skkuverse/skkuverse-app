// The allowlist ratchet behind every structure rule in scripts/architecture/
// (ADR 0020 D5). A rule computes its violations as sorted keys whose first
// space-separated token is a repository path; `allowlists/<rule>.json` holds
// the keys recorded when the rule was switched on. A check fails on
//   1. a violation that is not listed,
//   2. a listed key that no longer violates (the list must shrink with the fix),
//   3. a listed key the base revision's list did not hold, unless the base had
//      no list at all (that is the rule being switched on),
//   4. a listed key whose path did not exist at the base revision, so a file a
//      change adds is never on a list.
// The base is $ARCH_BASE, else HEAD: the previous commit when the commit gate
// runs, the push or pull-request base in CI.
//
// ARCH_WRITE=1 writes the regenerated list. Rules 3 and 4 still hold, so it can
// only shrink a list, or seed one that does not exist at the base. A rule's list
// must be committed, as [] when nothing violates; a missing one fails.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOWLISTS = 'scripts/architecture/allowlists';

/** Whether a source path is out of the structure rules' reach: not TypeScript, a test, a declaration, a fixture. */
export function isUncheckedSource(path) {
  return (
    !/\.(ts|tsx)$/.test(path) ||
    /\.test\.(ts|tsx|mts)$/.test(path) ||
    path.endsWith('.d.ts') ||
    path.includes('/__fixtures__/')
  );
}

/** The path a key names: its first space-separated token. */
export function pathOf(key) {
  return key.split(' ')[0];
}

/**
 * Compares a rule's violations with its allowlist. Pure: the base's list and
 * the set of paths at the base are passed in (`baseList` null when the base has
 * no list file). Returns the error lines and the regenerated sorted list.
 */
export function compareAllowlist({ rule, violations, allowlist, baseList, basePaths, explain = () => null }) {
  const errors = [];
  const listed = new Set(allowlist);
  const violating = new Set(violations);
  const regenerated = [...violating].filter((key) => listed.has(key)).sort();

  for (const key of [...violating].sort()) {
    if (!listed.has(key)) {
      const reason = explain(key);
      errors.push(reason ? `${rule}: ${key}: ${reason}` : `${rule}: ${key}`);
    }
  }
  for (const key of [...listed].sort()) {
    if (!violating.has(key)) {
      errors.push(`${rule}: ${key} is listed but no longer violates. Remove it from the allowlist.`);
    }
  }
  if (baseList !== null) {
    const before = new Set(baseList);
    for (const key of [...listed].sort()) {
      if (!before.has(key)) {
        errors.push(`${rule}: ${key} was added to the allowlist. A list only shrinks; fix the code instead.`);
      }
    }
  }
  for (const key of [...listed].sort()) {
    if (!basePaths.has(pathOf(key))) {
      errors.push(`${rule}: ${key} names a file this change adds. A new file follows ADR 0020 and is never listed.`);
    }
  }
  return { errors, regenerated };
}

function git(args) {
  // WHY: a list missing at the base is expected (a rule being switched on); keep git's "fatal:" out of the output.
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function base() {
  return process.env.ARCH_BASE || 'HEAD';
}

let basePathsCache = null;

/** Every path tracked at the base revision. */
export function basePaths() {
  if (!basePathsCache) {
    basePathsCache = new Set(git(['ls-tree', '-r', '--name-only', '-z', base()]).split('\0').filter(Boolean));
  }
  return basePathsCache;
}

/** The files a commit can carry: tracked ones plus untracked ones git does not ignore. */
export function repoFiles() {
  return git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter((path) => path && existsSync(join(repoRoot, path)));
}

function listPath(rule) {
  return `${ALLOWLISTS}/${rule}.json`;
}

function readList(rule) {
  const path = join(repoRoot, listPath(rule));
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
}

function readBaseList(rule) {
  try {
    return JSON.parse(git(['show', `${base()}:${listPath(rule)}`]));
  } catch {
    return null;
  }
}

/**
 * Runs the ratchet for one rule against the repository. Returns the error
 * lines; when there are any, the last one carries the regenerated list.
 */
export function ratchetAllowlist(rule, violations, explain) {
  // WHY: with no list committed, the base reads as "no list" forever, and ARCH_WRITE=1 would seed anything.
  const missing = !existsSync(join(repoRoot, listPath(rule)));
  const allowlist = readList(rule);
  const baseList = readBaseList(rule);
  const { errors, regenerated } = compareAllowlist({
    rule,
    violations,
    allowlist,
    baseList,
    basePaths: basePaths(),
    explain,
  });
  if (process.env.ARCH_WRITE === '1') {
    // Seeding (no list at the base) records today's violations on files that
    // exist at the base; otherwise the list can only lose entries.
    const written =
      baseList === null ? [...new Set(violations)].filter((key) => basePaths().has(pathOf(key))).sort() : regenerated;
    writeFileSync(join(repoRoot, listPath(rule)), `${JSON.stringify(written, null, 2)}\n`);
  }
  if (missing && process.env.ARCH_WRITE !== '1') {
    errors.push(`${rule}: ${listPath(rule)} is missing. Commit it, as [] when nothing violates, so the list can only shrink.`);
  }
  if (errors.length > 0) {
    errors.push(
      `Regenerated ${listPath(rule)} (write it with ARCH_WRITE=1 when the change only shrinks it):\n` +
        JSON.stringify(regenerated, null, 2),
    );
  }
  return errors;
}
