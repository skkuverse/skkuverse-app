import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyCommentViolations } from './history.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';

const CASES = [
  ['// This used to be a 24 h window.', ['used to']],
  ['/** Ported from packages/shared. */', ['ported']],
  ['// Read with parseInt, as it always has been.', ['as it always has']],
  ['// The legacy route.\n// Previously the old one.', ['legacy', 'previously']],
  ['// WHY: only the undrawable is checked, as before the parse moved.', ['as before']],
  ['// Keyed the same as it was in v1.', ['as before']],
  ['// Twice as fast than before.', ['as before']],
  ['// Originally a per-campus list.', ['originally']],
  ['// Replaced by the shared map in 3.6.', ['replaced by']],
  ['// Formerly the campus tab.', ['formerly']],
  ['// Kept for byte parity with the old parser.', ['byte-parity']],
  ['// Same order as before the refactor.', ['before the refactor', 'as before']],
  ['// A token is valid from its issue until now plus its TTL.', []],
  ['// Used to decide the rule below.', []],
  ['// Run before the first read, as the boot does.', []],
  ['// A list that is used to build the index.', []],
  ["const s = 'it used to be';", []],
];

for (const [source, phrases] of CASES) {
  test(`${JSON.stringify(source)} names ${JSON.stringify(phrases)}`, () => {
    // Act
    const found = historyCommentViolations(FILE, source).map((v) => v.message);

    // Assert
    assert.deepEqual(found, phrases);
  });
}

test('reports each phrase at the line its comment opens on', () => {
  // Arrange
  const source = '// legacy one\nconst a = 1;\n// legacy two';

  // Act & Assert
  assert.deepEqual(historyCommentViolations(FILE, source), [
    { line: 1, message: 'legacy' },
    { line: 3, message: 'legacy' },
  ]);
});
