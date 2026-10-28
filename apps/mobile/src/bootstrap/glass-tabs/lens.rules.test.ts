/**
 * The lens's two-edge span and what a scrub's release selects.
 */

import { describe, it, expect } from 'vitest';
import { lensSpan, scrubReleaseSelects } from './lens.rules';

describe('lensSpan', () => {
  it('is one cell at rest, wherever the lens is', () => {
    expect(lensSpan(2, 2, 0.35)).toStrictEqual({ from: 2, cells: 0 });
    expect(lensSpan(0.5, 0.5, 0.35)).toStrictEqual({ from: 0.5, cells: 0 });
  });

  it('starts at the trailing edge and stretches by the lag while the lead is ahead', () => {
    // Moving right: the trail is behind (left of) the lead.
    expect(lensSpan(2, 1.8, 0.35)).toStrictEqual({ from: 1.8, cells: expect.closeTo(0.2, 6) as number });
    // Moving left: the trail is to the right, so the lens starts at the lead.
    expect(lensSpan(1, 1.2, 0.35)).toStrictEqual({ from: 1, cells: expect.closeTo(0.2, 6) as number });
  });

  it('caps the stretch at the lag limit, whichever way the lens moves', () => {
    expect(lensSpan(3, 0, 0.35)).toStrictEqual({ from: expect.closeTo(2.65, 6) as number, cells: 0.35 });
    expect(lensSpan(0, 3, 0.35)).toStrictEqual({ from: 0, cells: 0.35 });
  });
});

describe('scrubReleaseSelects', () => {
  it('selects the tab under the finger when it is another tab', () => {
    expect(scrubReleaseSelects({ start: 0, release: 1, crossedCell: true })).toBe(true);
    expect(scrubReleaseSelects({ start: 3, release: 0, crossedCell: true })).toBe(true);
  });

  it('selects nothing when a scrub that visited another cell comes back to its start', () => {
    expect(scrubReleaseSelects({ start: 1, release: 1, crossedCell: true })).toBe(false);
  });

  it('treats a touch that never left its cell as a tap, which selects (a re-tap on the tab in front)', () => {
    expect(scrubReleaseSelects({ start: 1, release: 1, crossedCell: false })).toBe(true);
  });
});
