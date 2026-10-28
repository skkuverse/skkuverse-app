// The file-level exceptions registry (scripts/eslint/sds-exceptions.cjs) and
// its wiring into the root ESLint config. An entry whose file is gone keeps a
// rule switched off for nothing and reads as a live exception in the audit,
// and an entry without a reason is an exception nobody can review.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const registry = require('./sds-exceptions.cjs');
const plugin = require('./plugin-sds.cjs');

const GLOB = /[*?[\]{}!]/;

/** Every way `entry` is malformed, as messages; [] when it is sound. */
function problemsOf(entry, { root, ruleIds }) {
  const problems = [];
  const isStringArray = (value) => Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string');
  if (!isStringArray(entry?.files)) problems.push('`files` must be a non-empty array of paths');
  else {
    for (const file of entry.files) {
      if (GLOB.test(file)) problems.push(`${file}: a glob, which is a scope; put it in the rule's config block`);
      else if (!existsSync(join(root, file)) || !statSync(join(root, file)).isFile()) problems.push(`${file}: no such file`);
    }
  }
  if (!isStringArray(entry?.rules)) problems.push('`rules` must be a non-empty array of rule IDs');
  else {
    for (const rule of entry.rules) {
      if (!ruleIds.has(rule)) problems.push(`${rule}: not a rule of the sds plugin`);
    }
  }
  if (typeof entry?.reason !== 'string' || entry.reason.trim() === '') problems.push('`reason` must say why');
  return problems;
}

const ruleIds = new Set(Object.keys(plugin.rules).map((name) => `sds/${name}`));
const label = (entry, i) => `entry ${i}: ${entry?.files?.join(', ') ?? '(no files)'}`;

describe('the exceptions registry', () => {
  test('is an array', () => assert.ok(Array.isArray(registry)));

  registry.forEach((entry, i) => {
    test(`${label(entry, i)} names existing files, sds rules and a reason`, () => {
      assert.deepEqual(problemsOf(entry, { root, ruleIds }), []);
    });
  });
});

describe('the registry check', () => {
  const sound = {
    files: ['scripts/eslint/plugin-sds.cjs'],
    rules: ['sds/require-disable-reason'],
    reason: 'a fixture that exists',
  };

  test('accepts a sound entry', () => {
    assert.deepEqual(problemsOf(sound, { root, ruleIds }), []);
  });

  test('rejects an entry whose file does not exist', () => {
    const problems = problemsOf({ ...sound, files: ['apps/mobile/src/gone.tsx'] }, { root, ruleIds });
    assert.deepEqual(problems, ['apps/mobile/src/gone.tsx: no such file']);
  });

  test('rejects an entry with an empty reason', () => {
    assert.deepEqual(problemsOf({ ...sound, reason: '  ' }, { root, ruleIds }), ['`reason` must say why']);
  });

  test('rejects a glob and a rule the plugin does not define', () => {
    const problems = problemsOf({ ...sound, files: ['apps/mobile/**'], rules: ['sds/typo'] }, { root, ruleIds });
    assert.equal(problems.length, 2);
  });
});

describe('the root ESLint config', () => {
  const { ESLint } = require('eslint');
  const eslint = new ESLint({ cwd: root });
  // Any file the config lints: the guard applies everywhere.
  const sample = 'apps/mobile/app/_layout.tsx';

  test('runs sds/require-disable-reason at error and fails a stale disable', async () => {
    const config = await eslint.calculateConfigForFile(sample);
    assert.deepEqual(config.rules['sds/require-disable-reason'], [2]);
    assert.equal(config.linterOptions.reportUnusedDisableDirectives, 2);
  });

  registry.forEach((entry, i) => {
    test(`switches off the rules of ${label(entry, i)}`, async () => {
      for (const file of entry.files) {
        const config = await eslint.calculateConfigForFile(file);
        for (const rule of entry.rules) assert.deepEqual(config.rules[rule], [0], `${rule} in ${file}`);
      }
    });
  });
});
