import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksOf, commentsOf } from './extract.mjs';

const TS = 'apps/mobile/src/features/x/x.rules.ts';
const TSX = 'apps/mobile/src/features/x/X.tsx';

test('reads comments through the parser, never out of a string, a template or a regex', () => {
  // Arrange
  const source = [
    '// one',
    'const url = "https://a.dev/x // not a comment";',
    'const t = `// not a comment either`;',
    'const re = /\\/\\/ nor this/;',
    'const a = 1; /* two */',
  ].join('\n');

  // Act
  const raws = commentsOf(TS, source).map((c) => c.raw);

  // Assert
  assert.deepEqual(raws, ['// one', '/* two */']);
});

test('reads a JSX expression comment and never JSX text', () => {
  // Arrange
  const source = [
    'export const X = () => (',
    '  <View>',
    '    {/* WHY: a reason */}',
    '    <Text>see http://a.dev // not a comment</Text>',
    '    <Text>',
    '      // nor this',
    '    </Text>',
    '  </View>',
    ');',
  ].join('\n');

  // Act
  const raws = commentsOf(TSX, source).map((c) => c.raw);

  // Assert
  assert.deepEqual(raws, ['/* WHY: a reason */']);
});

test('joins adjacent own-line // comments into one block, and splits at code, a blank line or a trailing comment', () => {
  // Arrange
  const source = ['// one', '// two', '', '// three', 'const a = 1; // four', '// five', '/** six', ' * seven */'].join(
    '\n',
  );

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.deepEqual(blocks, [
    { line: 1, text: ['one', 'two'] },
    { line: 4, text: ['three'] },
    { line: 5, text: ['four'] },
    { line: 6, text: ['five'] },
    { line: 7, text: ['six', 'seven'] },
  ]);
});

test('leaves out compiler directives: a shebang, triple-slash, @ts-expect-error and eslint-disable with a reason', () => {
  // Arrange
  const source = [
    '#!/usr/bin/env node',
    '/// <reference types="node" />',
    '// eslint-disable-next-line no-console -- a reason',
    'console.log(1);',
    '// @ts-expect-error the upstream type omits it',
    "const x: number = 'a';",
    '/* eslint-enable no-console */',
  ].join('\n');

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.deepEqual(blocks, []);
});

test('leaves out a one-line @deprecated with its replacement, which the compiler and editors read', () => {
  // Arrange
  const source = ['/** @deprecated Use `r1`. */', 'export const xs = 4;'].join('\n');

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.deepEqual(blocks, []);
});

test('keeps a bare @deprecated as comment text', () => {
  // Arrange
  const source = ['/** @deprecated */', 'export const xs = 4;'].join('\n');

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.equal(blocks.length, 1);
});

test('keeps a bare @ts-expect-error and an eslint-disable without a reason as comment text', () => {
  // Arrange
  const source = ['// @ts-expect-error', "const x: number = 'a';", '// eslint-disable-next-line no-console', 'console.log(1);'].join(
    '\n',
  );

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.deepEqual(blocks, [
    { line: 1, text: ['@ts-expect-error'] },
    { line: 3, text: ['eslint-disable-next-line no-console'] },
  ]);
});

test('starts a block at its first line of text when an eslint directive opens the run', () => {
  // Arrange
  const source = ['// eslint-disable-next-line no-console -- a reason', '// Logs once.', 'console.log(1);'].join('\n');

  // Act
  const blocks = blocksOf(TS, source);

  // Assert
  assert.deepEqual(blocks, [{ line: 2, text: ['Logs once.'] }]);
});
