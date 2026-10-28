// The two SDS reports: per-rule totals from the suppressions record
// (`yarn sds:report`) and the labelled list of exceptions and debt
// (`yarn sds:exceptions`). The ESLint results below follow the shape of
// `eslint -f json`: a suppressed message carries `suppressions[]`, whose
// `kind` is "directive" for an inline disable and "file" for the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exceptionRows, formatRows, totalsByRule } from './sds-report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = '/repo';

test('totals sum each rule across files, largest first', () => {
  const totals = totalsByRule({
    'a.tsx': { 'sds/no-color-literal': { count: 3 }, 'sds/no-rn-text': { count: 1 } },
    'b.tsx': { 'sds/no-color-literal': { count: 2 } },
  });
  assert.deepEqual(totals, [
    { rule: 'sds/no-color-literal', count: 5, files: 2 },
    { rule: 'sds/no-rn-text', count: 1, files: 1 },
  ]);
});

test('an empty record has no totals', () => {
  assert.deepEqual(totalsByRule({}), []);
});

const suppressed = (ruleId, line, kind, justification = '') => ({
  ruleId,
  severity: 2,
  line,
  suppressions: [{ kind, justification }],
});

const results = [
  {
    filePath: '/repo/apps/mobile/src/A.tsx',
    suppressedMessages: [
      suppressed('sds/no-color-literal', 12, 'directive', 'data color from the server'),
      suppressed('sds/no-color-literal', 20, 'file'),
      suppressed('sds/no-color-literal', 31, 'file'),
      suppressed('react-hooks/exhaustive-deps', 40, 'directive'),
    ],
  },
  { filePath: '/repo/apps/mobile/src/B.tsx', suppressedMessages: [] },
];
const registry = [
  { files: ['apps/mobile/src/data/lines.ts'], rules: ['sds/no-color-literal'], reason: 'data color, not UI' },
];

test('a disable comment and a registry entry are exceptions with their reasons; the record is debt', () => {
  assert.deepEqual(exceptionRows(results, registry, { root }), [
    {
      label: 'exception',
      rule: 'sds/no-color-literal',
      location: 'apps/mobile/src/A.tsx:12',
      reason: 'data color from the server',
      source: 'disable comment',
    },
    {
      label: 'exception',
      rule: 'sds/no-color-literal',
      location: 'apps/mobile/src/data/lines.ts',
      reason: 'data color, not UI',
      source: 'registry',
    },
    {
      label: 'debt',
      rule: 'sds/no-color-literal',
      location: 'apps/mobile/src/A.tsx',
      reason: '2 recorded violations',
      source: 'eslint-suppressions.json',
    },
  ]);
});

test('other rules are left out unless every rule is asked for', () => {
  const rows = exceptionRows(results, [], { root, all: true });
  const hooks = rows.find((row) => row.rule === 'react-hooks/exhaustive-deps');
  assert.equal(hooks.reason, '(no reason given)');
  assert.equal(hooks.location, 'apps/mobile/src/A.tsx:40');
  assert.ok(!exceptionRows(results, [], { root }).some((row) => row.rule === 'react-hooks/exhaustive-deps'));
});

test('each printed row starts with its label', () => {
  const lines = formatRows(exceptionRows(results, registry, { root })).split('\n');
  assert.deepEqual(
    lines.map((line) => line.split(/\s+/)[0]),
    ['exception', 'exception', 'debt'],
  );
  assert.match(lines[0], /apps\/mobile\/src\/A\.tsx:12 .* data color from the server$/);
});

test('`yarn sds:report` runs against the repository', () => {
  const run = spawnSync(process.execPath, [resolve(here, 'sds-report.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^(sds:report: no recorded violations|\S+\s+\d+\s+in \d+ files)/m);
});
