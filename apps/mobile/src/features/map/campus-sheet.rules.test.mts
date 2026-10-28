/**
 * Where the campus sheet can sit, and where it opens.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, not vitest.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_SHEET_DETENTS } from './campus-sheet.rules.ts';

describe('CAMPUS_SHEET_DETENTS', () => {
  it('opens at its floor', () => {
    assert.equal(CAMPUS_SHEET_DETENTS.initial, 'small');
    assert.equal(CAMPUS_SHEET_DETENTS.percents[0], 24);
  });

  it('keeps the two stops ascending and apart', () => {
    const [small, medium] = CAMPUS_SHEET_DETENTS.percents;
    assert.ok(medium - small >= 10, `${small} / ${medium} read as one stop`);
  });
});
