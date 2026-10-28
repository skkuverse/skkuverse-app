import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionCommentViolations } from './sections.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';

test('finds dashed, double and box-drawing dividers on // lines', () => {
  // Arrange
  const source = [
    '// --- Sync ---',
    'const a = 1;',
    '// === Responses ===',
    '  // ── Import boundaries (D9) ──',
    '// ------------------',
    '// --- Sync ---',
    '// ══ Labels ══',
    '// ━━ Rows ━━',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(sectionCommentViolations(FILE, source), [
    { line: 1, message: 'Sync' },
    { line: 3, message: 'Responses' },
    { line: 4, message: 'Import boundaries (D9)' },
    { line: 5, message: '(rule)' },
    { line: 6, message: 'Sync' },
    { line: 7, message: 'Labels' },
    { line: 8, message: 'Rows' },
  ]);
});

test('finds a divider or an underline inside a multi-line block comment', () => {
  // Arrange
  const source = [
    '/**',
    ' * Ranking.',
    ' *',
    ' * THE RANKING SIGNAL',
    ' * ------------------',
    ' * --- Bands ---',
    ' */',
    'const a = 1;',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(sectionCommentViolations(FILE, source), [
    { line: 5, message: 'THE RANKING SIGNAL' },
    { line: 6, message: 'Bands' },
  ]);
});

test('finds a divider in a JSX expression comment, on one line or several', () => {
  // Arrange
  const source = [
    'export const X = () => (',
    '  <View>',
    '    {/* ══ Section: Description ══ */}',
    '    {/*',
    '      --- Header ---',
    '    */}',
    '  </View>',
    ');',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(sectionCommentViolations('apps/mobile/src/features/x/X.tsx', source), [
    { line: 3, message: 'Section: Description' },
    { line: 5, message: 'Header' },
  ]);
});

test('leaves ordinary comments, trailing comments and strings alone', () => {
  // Arrange
  const source = [
    '// -- an aside',
    '// --no-verify is a flag',
    '/* --- one-line block comments are not dividers --- */',
    '// a - b - c',
    'const a = 1; // --- trailing',
    "const s = '// --- not a comment line';",
  ].join('\n');

  // Act & Assert
  assert.deepEqual(sectionCommentViolations(FILE, source), []);
});
