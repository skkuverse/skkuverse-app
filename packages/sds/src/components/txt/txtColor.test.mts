// Txt resolves a foreground role name in the scheme it renders in, and
// passes any other color through.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SemanticColors } from '@skkuverse/shared';
import { resolveTxtColor } from './txtColor.ts';

// Two schemes' foregrounds, as far as the test reads them.
const light = { neutral: '#light-neutral', neutralSubtle: '#light-subtle' } as unknown as SemanticColors['fg'];
const dark = { neutral: '#dark-neutral', neutralSubtle: '#dark-subtle' } as unknown as SemanticColors['fg'];

test('a role name resolves in the scheme given, a value passes through, and unset is fg.neutral', () => {
  assert.equal(resolveTxtColor('neutralSubtle', light), '#light-subtle');
  assert.equal(resolveTxtColor('neutralSubtle', dark), '#dark-subtle');
  assert.equal(resolveTxtColor('#123456', light), '#123456');
  assert.equal(resolveTxtColor(undefined, dark), '#dark-neutral');
});

test('a name an object inherits is not a role', () => {
  assert.equal(resolveTxtColor('toString', light), 'toString');
});
