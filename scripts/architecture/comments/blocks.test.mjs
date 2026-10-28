import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longCommentViolations } from './blocks.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';

test('flags a block comment or a run of // lines over three lines of text', () => {
  // Arrange
  const source = [
    '/**',
    ' * One.',
    ' *',
    ' * Two.',
    ' * Three.',
    ' * Four.',
    ' */',
    'const a = 1;',
    '// one',
    '// two',
    '// three',
    '// four',
    'const b = 2;',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(longCommentViolations(FILE, source), [
    { line: 1, message: 'One.' },
    { line: 9, message: 'one' },
  ]);
});

test('allows three lines, and splits // runs at code, a blank line or a trailing comment', () => {
  // Arrange
  const source = [
    '/** One.',
    ' * Two.',
    ' * Three. */',
    '// one',
    '// two',
    '',
    '// three',
    '// four',
    'const a = 1; // trailing',
    '// five',
    '// six',
    '// seven',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(longCommentViolations(FILE, source), []);
});

test('does not count eslint directives, and reads no comment out of strings or templates', () => {
  // Arrange
  const source = [
    '// eslint-disable-next-line no-console -- a reason',
    '// one',
    '// two',
    '// three',
    'const url = "https://a.dev/x"; // one line',
    'const t = `',
    '// not',
    '// a',
    '// comment',
    '// either',
    '`;',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(longCommentViolations(FILE, source), []);
});
