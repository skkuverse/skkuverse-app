import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentTagViolations } from './tags.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';
const none = { exists: () => false };
const messages = (source, ctx = none) => commentTagViolations(FILE, source, ctx).map((v) => v.message);

test('passes each tag with text after it, on a block\'s first line', () => {
  // Arrange
  const source = [
    '// WHY: a choice someone might undo.',
    '/** QUIRK(ios): the keyboard rises only for a focus inside a tap. */',
    '// CONTRACT(skkuverse-server): it serves this shape',
    '// (skkuverse-server/src/map/map.controller.ts).',
    'const s = 0;',
    '/**',
    ' * EVIDENCE: 2026-10-01 incident, p99 1.2 s.',
    ' * More lines need no tag.',
    ' */',
    '// SEE: docs/decisions/0020-app-architecture.md',
    'const a = 1; // WHY: trailing comments are blocks too.',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source), []);
});

test('flags an untagged comment, a lowercase tag and a tag with nothing after it, at the block\'s line', () => {
  // Arrange
  const source = ['// Root module.', 'const a = 1;', '// Why: lowercase.', 'const b = 2;', '/** WHY: */'].join('\n');

  // Act
  const violations = commentTagViolations(FILE, source, none);

  // Assert
  assert.deepEqual(violations, [
    { line: 1, message: 'Root module.' },
    { line: 3, message: 'Why: lowercase.' },
    { line: 5, message: 'WHY:' },
  ]);
});

test('flags a JSDoc on an export like any other comment', () => {
  // Arrange
  const source = ['/** The campus the toggle holds. */', 'export const campus = 1;'].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source), ['The campus the toggle holds.']);
});

test('flags a CONTRACT without a cited path or naming a repo that is not public, and a SEE without a docs/ path', () => {
  // Arrange
  const source = [
    '// CONTRACT(skkuverse-server): the server reads this field.',
    'const a = 1;',
    '// CONTRACT(skkuverse-internal): see skkuverse-internal/functions/x.ts.',
    'const b = 2;',
    '// CONTRACT(skkuverse-app): see skkuverse-app/x.ts.',
    'const c = 3;',
    '// SEE: the ADR.',
    'const d = 4;',
    '// SEE: docs/how-to/missing.json',
    'const e = 5;',
    '// QUIRK(IOS): uppercase system.',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source), [
    'CONTRACT(skkuverse-server): the server reads this field. [no <repo>/<path> cited]',
    'CONTRACT(skkuverse-internal): see skkuverse-internal/functio [unknown repo skkuverse-internal]',
    'CONTRACT(skkuverse-app): see skkuverse-app/x.ts. [unknown repo skkuverse-app]',
    'SEE: the ADR. [no docs/ path]',
    'SEE: docs/how-to/missing.json [missing docs/how-to/missing.json]',
    'QUIRK(IOS): uppercase system.',
  ]);
});

test('passes a SEE to a docs/ path that exists, and leaves a cited .md to the doc-paths rule', () => {
  // Arrange
  const source = ['// SEE: docs/how-to/present.json', 'const a = 1;', '// SEE: docs/how-to/absent.md'].join('\n');
  const ctx = { exists: (rel) => rel === 'docs/how-to/present.json' };

  // Act & Assert
  assert.deepEqual(messages(source, ctx), []);
});

test('exempts compiler directives and flags a bare @ts-expect-error or an eslint-disable without a reason', () => {
  // Arrange
  const exempt = [
    '#!/usr/bin/env node',
    '/// <reference types="node" />',
    '// eslint-disable-next-line no-console -- a reason',
    'console.log(1);',
    '// @ts-expect-error the upstream type omits it',
    "const x: number = 'a';",
  ].join('\n');
  const bare = ['// @ts-expect-error', "const x: number = 'a';", '// eslint-disable-next-line no-console', 'console.log(1);'].join(
    '\n',
  );

  // Act & Assert
  assert.deepEqual(messages(exempt), []);
  assert.deepEqual(messages(bare), ['@ts-expect-error', 'eslint-disable-next-line no-console']);
});

test('checks a block\'s first text line after an eslint directive', () => {
  // Arrange
  const source = ['// eslint-disable-next-line no-console -- a reason', '// Logs once.', 'console.log(1);'].join('\n');

  // Act & Assert
  assert.deepEqual(messages(source), ['Logs once.']);
});
