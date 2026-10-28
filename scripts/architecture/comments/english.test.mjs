import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hangulCommentViolations } from './english.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';
const messages = (source, file = FILE) => hangulCommentViolations(file, source).map((v) => v.message);

test('reports a comment with Hangul, line, trailing or block', () => {
  // Arrange
  const source = [
    '// 혜화역 poller',
    'const a = 1; // trailing 주석',
    '/**',
    ' * The first line is English.',
    ' * The second names 인사캠.',
    ' */',
    'function f(): void {}',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(hangulCommentViolations(FILE, source), [
    { line: 1, message: '혜화역 poller' },
    { line: 2, message: 'trailing 주석' },
    { line: 3, message: 'The first line is English.' },
  ]);
});

test('reports Hangul in a backticked code span: a quote needs the marker too', () => {
  // Act & Assert
  assert.deepEqual(messages('// QUIRK(skku): one building reads `승장애인 표시 승강기`.'), [
    'QUIRK(skku): one building reads `승장애인 표시 승강기`.',
  ]);
});

test('passes a line that carries the conventions:allow-korean marker with a reason', () => {
  // Arrange
  const source = [
    '// QUIRK(skku): the layer is labelled 주점. conventions:allow-korean: the product term',
    'const a = 1;',
    '{/* WHY: 명예의 전당 is the name players see. conventions:allow-korean: the product term */}',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source, 'apps/mobile/src/features/x/X.tsx'), []);
});

test('reports a marker with no reason, and a Hangul line the marker on another line does not cover', () => {
  // Arrange
  const bare = '// WHY: the label is 주점. conventions:allow-korean';
  const other = ['// WHY: the label is 주점.', '// conventions:allow-korean: the product term'].join('\n');

  // Act & Assert
  assert.deepEqual(messages(bare), ['WHY: the label is 주점. conventions:allow-korean']);
  assert.deepEqual(messages(other), ['WHY: the label is 주점.']);
});

test('passes Hangul in a string, a template, a regex or JSX text, and an English comment', () => {
  // Arrange
  const source = [
    'const label = "캠퍼스 지도"; // the campus map tile',
    'const url = `https://example.com/검색?q=${q}`;',
    'const re = /배리어프리/;',
    'const el = <Txt>명예의 전당</Txt>;',
    '// QUIRK(skku): the barrier-free header comes in three spellings.',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source, 'apps/mobile/src/features/x/X.tsx'), []);
});
