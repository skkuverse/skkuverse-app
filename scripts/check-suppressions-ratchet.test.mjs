// The guard behind `yarn lint` and CI that keeps eslint-suppressions.json from
// growing. Each case builds a throwaway git repository holding a copy of the
// script, commits a base record, changes the working tree the way a real
// change would, and runs the script there as the CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'check-suppressions-ratchet.mjs');
const RECORD = 'eslint-suppressions.json';

// The fixture repositories must not pick up the developer's git config
// (hooks, signing, templates), and the script must not see a CI summary file
// unless a case asks for one.
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
delete env.GITHUB_STEP_SUMMARY;

function git(root, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

/** A repository whose first commit holds `files` (path → text) and the script. */
function repo(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'scripts'));
  copyFileSync(script, join(root, 'scripts/check-suppressions-ratchet.mjs'));
  for (const [path, text] of Object.entries(files)) write(root, path, text);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}

function write(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const record = (entries) => `${JSON.stringify(entries, null, 2)}\n`;

function ratchet(root, args = [], extraEnv = {}) {
  const result = spawnSync('node', ['scripts/check-suppressions-ratchet.mjs', ...args], {
    cwd: root,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
  });
  return { status: result.status, out: result.stdout + result.stderr };
}

/** Two source files, `r1` recorded in both: 3 + 1. */
function legacy(t) {
  return repo(t, {
    'src/a.js': 'a\n',
    'src/b.js': 'b\n',
    [RECORD]: record({ 'src/a.js': { r1: { count: 3 } }, 'src/b.js': { r1: { count: 1 } } }),
  });
}

test('an unchanged record passes', (t) => {
  const root = legacy(t);
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /ok, 4 -> 4 recorded violations against HEAD/);
});

test('a record that shrank passes', (t) => {
  const root = legacy(t);
  write(root, RECORD, record({ 'src/a.js': { r1: { count: 2 } }, 'src/b.js': { r1: { count: 1 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /4 -> 3/);
});

test('a count that grew fails, naming the file, the rule and both counts', (t) => {
  const root = legacy(t);
  write(root, RECORD, record({ 'src/a.js': { r1: { count: 4 } }, 'src/b.js': { r1: { count: 1 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 1, out);
  assert.match(out, /src\/a\.js: r1 grew from 3 to 4/);
});

test('a new entry for a recorded rule fails', (t) => {
  const root = legacy(t);
  write(root, 'src/c.js', 'c\n');
  write(
    root,
    RECORD,
    record({ 'src/a.js': { r1: { count: 3 } }, 'src/b.js': { r1: { count: 1 } }, 'src/c.js': { r1: { count: 1 } } }),
  );
  const { status, out } = ratchet(root);
  assert.equal(status, 1, out);
  assert.match(out, /src\/c\.js: r1 has a new entry \(1\)/);
});

test('an entry that moved with a `git mv` passes', (t) => {
  const root = legacy(t);
  git(root, 'mv', 'src/a.js', 'src/renamed.js');
  write(root, RECORD, record({ 'src/renamed.js': { r1: { count: 3 } }, 'src/b.js': { r1: { count: 1 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
});

test('an entry that moved with a `git mv` still may not grow', (t) => {
  const root = legacy(t);
  git(root, 'mv', 'src/a.js', 'src/renamed.js');
  write(root, RECORD, record({ 'src/renamed.js': { r1: { count: 4 } }, 'src/b.js': { r1: { count: 1 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 1, out);
  assert.match(out, /src\/renamed\.js: r1 grew from 3 to 4/);
});

test('a rename git has not seen reads as a new entry and points at `git mv`', (t) => {
  const root = legacy(t);
  write(root, 'src/renamed.js', 'a\n'); // untracked: a plain mv, not staged
  rmSync(join(root, 'src/a.js'));
  write(root, RECORD, record({ 'src/renamed.js': { r1: { count: 3 } }, 'src/b.js': { r1: { count: 1 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 1, out);
  assert.match(out, /src\/renamed\.js: r1 has a new entry/);
  assert.match(out, /git mv/);
});

test('a rule ID the base never recorded may appear', (t) => {
  const root = legacy(t);
  write(
    root,
    RECORD,
    record({ 'src/a.js': { r1: { count: 3 }, r2: { count: 5 } }, 'src/b.js': { r1: { count: 1 } } }),
  );
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /4 -> 9/);
  assert.match(out, /first record of r2/);
});

test('an entry whose file no longer exists fails', (t) => {
  const root = legacy(t);
  git(root, 'rm', '-q', 'src/b.js');
  const { status, out } = ratchet(root);
  assert.equal(status, 1, out);
  assert.match(out, /src\/b\.js: recorded, but the file does not exist/);
  assert.match(out, /yarn lint:prune/);
});

test('no record anywhere reads as empty and passes', (t) => {
  const root = repo(t, { 'src/a.js': 'a\n' });
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /ok, 0 -> 0/);
});

test("a first record when the base had none passes, every rule being new", (t) => {
  const root = repo(t, { 'src/a.js': 'a\n' });
  write(root, RECORD, record({ 'src/a.js': { r1: { count: 2 } } }));
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /first record of r1/);
});

test('deleting the whole record passes: it only shrank', (t) => {
  const root = legacy(t);
  rmSync(join(root, RECORD));
  const { status, out } = ratchet(root);
  assert.equal(status, 0, out);
  assert.match(out, /4 -> 0/);
});

test('an explicit base compares against that commit, not HEAD', (t) => {
  const root = legacy(t);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  write(root, RECORD, record({ 'src/a.js': { r1: { count: 4 } }, 'src/b.js': { r1: { count: 1 } } }));
  git(root, 'commit', '-q', '-am', 'grow');
  assert.equal(ratchet(root).status, 0, 'against HEAD the committed growth is the base');
  const { status, out } = ratchet(root, [base]);
  assert.equal(status, 1, out);
  assert.match(out, /grew from 3 to 4/);
});

test('a base that is not a commit exits 2', (t) => {
  const root = legacy(t);
  const { status, out } = ratchet(root, ['0000000000000000000000000000000000000000']);
  assert.equal(status, 2, out);
  assert.match(out, /cannot resolve/);
});

test('a record that is not JSON exits 2', (t) => {
  const root = legacy(t);
  write(root, RECORD, '{ not json');
  const { status, out } = ratchet(root);
  assert.equal(status, 2, out);
});

test('in CI the job summary lists the new rule IDs', (t) => {
  const root = legacy(t);
  write(
    root,
    RECORD,
    record({ 'src/a.js': { r1: { count: 3 }, 'sds/new-rule': { count: 2 } }, 'src/b.js': { r1: { count: 1 } } }),
  );
  const summary = join(root, 'summary.md');
  writeFileSync(summary, '');
  const { status, out } = ratchet(root, [], { GITHUB_STEP_SUMMARY: summary });
  assert.equal(status, 0, out);
  const text = readFileSync(summary, 'utf8');
  assert.match(text, /Suppressions ratchet against `HEAD`/);
  assert.match(text, /- `sds\/new-rule`/);
});
