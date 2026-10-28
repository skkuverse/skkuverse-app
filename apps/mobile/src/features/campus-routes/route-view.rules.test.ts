/**
 * How the route page pushed back by a place's close comes back as it was left:
 * the scroll offset it restores, and the key a shown ride is kept under.
 */
import { describe, expect, it } from 'vitest';
import { decideScrollRestore, rideKey } from './route-view.rules';

describe('decideScrollRestore', () => {
  it('scrolls to the offset once the content is tall enough to show it', () => {
    expect(decideScrollRestore({ pending: 600, contentHeight: 1400, viewportHeight: 800, settled: false })).toStrictEqual({
      scrollTo: 600,
      done: true,
    });
  });

  it('waits while the content is shorter than the offset plus the viewport and the data is still arriving', () => {
    expect(decideScrollRestore({ pending: 600, contentHeight: 900, viewportHeight: 800, settled: false })).toStrictEqual({
      scrollTo: null,
      done: false,
    });
  });

  it('waits until the viewport is measured, settled or not', () => {
    expect(decideScrollRestore({ pending: 600, contentHeight: 1400, viewportHeight: 0, settled: true }).done).toBe(false);
  });

  it('gives up once the data has settled, at the furthest the content allows', () => {
    expect(decideScrollRestore({ pending: 600, contentHeight: 1000, viewportHeight: 800, settled: true })).toStrictEqual({
      scrollTo: 200,
      done: true,
    });
    expect(decideScrollRestore({ pending: 600, contentHeight: 500, viewportHeight: 800, settled: true })).toStrictEqual({
      scrollTo: 0,
      done: true,
    });
  });

  it('has nothing to do for a page that was at the top', () => {
    expect(decideScrollRestore({ pending: 0, contentHeight: 0, viewportHeight: 0, settled: false })).toStrictEqual({
      scrollTo: null,
      done: true,
    });
  });
});

describe('rideKey', () => {
  it('names a ride by its option, wherever a refetch puts the option', () => {
    const before = ['fast', 'cheap'].map((id) => rideKey(id, 1));
    const after = ['cheap', 'fast'].map((id) => rideKey(id, 1));

    expect(new Set(after)).toStrictEqual(new Set(before));
    expect(rideKey('fast', 1)).not.toBe(rideKey('cheap', 1));
  });
});
