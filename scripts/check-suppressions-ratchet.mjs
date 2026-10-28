#!/usr/bin/env node
// Fails when the ESLint bulk-suppressions record grows:
//
//   node scripts/check-suppressions-ratchet.mjs [base]    (base defaults to HEAD)
//
// `eslint-suppressions.json` holds, per file and rule, how many existing
// violations ESLint lets through. ESLint itself fails a file that goes over
// its count, fails a count the file no longer reaches until `yarn lint:prune`
// lowers it, and starts every unrecorded file at zero. What it cannot see is
// the record growing: running `--suppress-all` or `--suppress-rule` again
// writes today's violations down as the new allowance, and ESLint calls that
// clean. So this compares the working tree's record with the one at <base>
// (the last commit when run by `yarn lint`, the pushed or merged base in CI)
// and fails when
//   1. a (file, rule) count rose,
//   2. a (file, rule) entry appeared that is not a git rename of an entry
//      that carried it (`git diff -M` against <base>),
//   3. an entry names a file that does not exist.
// A rule ID the base record never mentions may appear: that is a rule being
// switched on, with its first record in the same commit. CI lists such IDs in
// the job summary so none slips through unread. A missing record is empty.
//
// Exit 0 when the record did not grow, 1 when it did, 2 when <base> does not
// resolve to a commit or a record is not valid JSON. With $GITHUB_STEP_SUMMARY
// set, the outcome and the new rule IDs are appended to the job summary.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RECORD = 'eslint-suppressions.json';
const HOW_TO = 'docs/how-to/work-under-the-lint-ratchet.md';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class UsageError extends Error {}

/** The total of every count in a record. */
export function total(record) {
  let sum = 0;
  for (const rules of Object.values(record)) for (const { count } of Object.values(rules)) sum += count;
  return sum;
}

/**
 * Compares two records. `renames` maps a path in the working tree to the path
 * it was renamed from since the base; `exists` says whether a path names a
 * file. Returns the violations of the three rules above and the rule IDs that
 * appear for the first time.
 */
export function compareRecords({ before, after, renames, exists }) {
  const rulesInBase = new Set(Object.values(before).flatMap((rules) => Object.keys(rules)));
  const errors = [];
  const newRules = new Set();
  for (const [file, rules] of Object.entries(after)) {
    if (!exists(file)) {
      errors.push(`${file}: recorded, but the file does not exist. Run \`yarn lint:prune\` to drop the entry.`);
    }
    const from = renames.get(file);
    for (const [rule, entry] of Object.entries(rules)) {
      const count = entry?.count;
      if (!Number.isInteger(count) || count < 0) {
        errors.push(`${file}: ${rule} has no valid count (${JSON.stringify(entry)}).`);
        continue;
      }
      const was = before[file]?.[rule]?.count ?? (from === undefined ? undefined : before[from]?.[rule]?.count);
      if (was === undefined) {
        if (rulesInBase.has(rule)) {
          errors.push(
            `${file}: ${rule} has a new entry (${count}). A file the record does not list starts at zero: fix the code. ` +
              'If the file was renamed, rename it with `git mv` so its entry can move with it.',
          );
        } else {
          newRules.add(rule);
        }
      } else if (count > was) {
        errors.push(`${file}: ${rule} grew from ${was} to ${count}. Fix the new violation instead of re-recording.`);
      }
    }
  }
  return { errors, newRules: [...newRules].sort() };
}

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function parseRecord(text, where) {
  try {
    const record = JSON.parse(text);
    if (record === null || typeof record !== 'object' || Array.isArray(record)) throw new Error('not an object');
    return record;
  } catch (error) {
    throw new UsageError(`${where} is not a valid suppressions record: ${error.message}`);
  }
}

/** The base's record, or an empty one when the base has none. */
function recordAt(commit, base) {
  try {
    git(['cat-file', '-e', `${commit}:${RECORD}`]);
  } catch {
    return {};
  }
  return parseRecord(git(['show', `${commit}:${RECORD}`]), `${base}:${RECORD}`);
}

/** Working-tree path → the path git saw it renamed from since `commit`. */
function renamesSince(commit) {
  const renames = new Map();
  const fields = git(['diff', '-M', '--name-status', '-z', commit, '--']).split('\0');
  for (let i = 0; i < fields.length - 1; ) {
    const status = fields[i];
    if (status.startsWith('R') || status.startsWith('C')) {
      if (status.startsWith('R')) renames.set(fields[i + 2], fields[i + 1]);
      i += 3;
    } else {
      i += 2;
    }
  }
  return renames;
}

function writeSummary(lines) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) appendFileSync(path, `${lines.join('\n')}\n\n`);
}

function main(argv) {
  const base = argv[0] ?? 'HEAD';
  let commit;
  try {
    commit = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).trim();
  } catch {
    throw new UsageError(`cannot resolve ${base} to a commit`);
  }
  const before = recordAt(commit, base);
  const recordPath = join(repoRoot, RECORD);
  const after = existsSync(recordPath) ? parseRecord(readFileSync(recordPath, 'utf8'), RECORD) : {};
  const renames = Object.keys(after).length > 0 ? renamesSince(commit) : new Map();
  const { errors, newRules } = compareRecords({
    before,
    after,
    renames,
    exists: (file) => existsSync(join(repoRoot, file)),
  });

  const counts = `${total(before)} -> ${total(after)} recorded violations`;
  const summary = [`### Suppressions ratchet against \`${base}\``, '', `${counts}.`];
  if (newRules.length > 0) {
    summary.push('', 'Rule IDs recorded for the first time (a rule being switched on):', '');
    for (const rule of newRules) summary.push(`- \`${rule}\``);
  }

  if (errors.length > 0) {
    console.error(`suppressions ratchet: ${RECORD} grew against ${base}:`);
    for (const error of errors) console.error(`  ${error}`);
    console.error(`Never re-record with --suppress-all or --suppress-rule. See ${HOW_TO}.`);
    summary.push('', '**Failed:**', '', ...errors.map((error) => `- ${error}`));
    writeSummary(summary);
    return 1;
  }
  console.log(`suppressions ratchet: ok, ${counts} against ${base}`);
  if (newRules.length > 0) console.log(`suppressions ratchet: first record of ${newRules.join(', ')}`);
  writeSummary(summary);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // Exit 1 means the record grew; anything that stops the comparison is 2.
    console.error(`suppressions ratchet: ${error instanceof UsageError ? error.message : error.stack}`);
    process.exitCode = 2;
  }
}
