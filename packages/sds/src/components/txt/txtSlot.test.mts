// A recipe slot reaches Txt without the keys Txt owns, and keeps its identity
// across renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { txtSlot } from './txtSlot.ts';

test('drops the size, line height, spacing, family and weight, and keeps the rest', () => {
  const slot = { color: '#000', textAlign: 'center', fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontFamily: 'X', fontWeight: '700' } as const;
  assert.deepEqual(txtSlot(slot), { color: '#000', textAlign: 'center' });
  assert.equal(slot.fontSize, 15, 'the recipe slot itself is not changed');
});

test('returns the same object for the same slot', () => {
  const slot = { color: '#000' };
  assert.equal(txtSlot(slot), txtSlot(slot));
});

test('passes an absent slot through', () => {
  assert.equal(txtSlot(undefined), undefined);
  assert.equal(txtSlot(false), undefined);
});
