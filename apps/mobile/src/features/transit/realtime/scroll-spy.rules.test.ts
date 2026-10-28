/**
 * The line sheet's direction tabs as a scroll spy (ADR 0022 §3): which
 * section the list is in, as Bootstrap's scrollspy decides it, and a tab
 * tap's hold while its scroll runs.
 */
import { describe, expect, it } from 'vitest';
import { STATION_ROW_HEIGHT } from './marker-geometry.rules';
import {
  activeSectionAt,
  listBottomPadding,
  sectionOffsets,
  spyReduce,
  tabPressScroll,
  tapScrollY,
  type SpyState,
} from './scroll-spy.rules';

describe('activeSectionAt', () => {
  const offsets = [100, 400, 900];
  const max = 2000;

  it('shows the first section before the first offset, where Bootstrap clears', () => {
    expect(activeSectionAt(offsets, 0, max)).toBe(0);
    expect(activeSectionAt(offsets, 99, max)).toBe(0);
  });

  it('shows the last section whose offset the scroll position has reached', () => {
    expect(activeSectionAt(offsets, 100, max)).toBe(0);
    expect(activeSectionAt(offsets, 399, max)).toBe(0);
    expect(activeSectionAt(offsets, 400, max)).toBe(1);
    expect(activeSectionAt(offsets, 899, max)).toBe(1);
    expect(activeSectionAt(offsets, 900, max)).toBe(2);
    expect(activeSectionAt(offsets, 1999, max)).toBe(2);
  });

  it('shows the last section once the scroll position reaches the maximum, though its offset is further down', () => {
    // Arrange
    const shortMax = 500;

    // Act & Assert
    expect(activeSectionAt(offsets, 499, shortMax)).toBe(1);
    expect(activeSectionAt(offsets, 500, shortMax)).toBe(2);
    expect(activeSectionAt(offsets, 650, shortMax)).toBe(2);
  });

  it('shows the later of two sections that start at one offset', () => {
    expect(activeSectionAt([0, 300, 300], 300, max)).toBe(2);
    expect(activeSectionAt([0, 300, 300], 299, max)).toBe(0);
  });

  it('shows the one section wherever the list is', () => {
    expect(activeSectionAt([0], 0, max)).toBe(0);
    expect(activeSectionAt([0], 1500, max)).toBe(0);
    expect(activeSectionAt([0], 2500, max)).toBe(0);
  });

  it('shows no section when there is none', () => {
    expect(activeSectionAt([], 0, max)).toBe(-1);
    expect(activeSectionAt([], 2500, max)).toBe(-1);
  });
});

describe('sectionOffsets', () => {
  it('puts each section at its first row’s top, rows being one fixed height', () => {
    // Act
    const offsets = sectionOffsets(
      [
        { id: 'a', label: 'A', firstRow: 0 },
        { id: 'b', label: 'B', firstRow: 6 },
      ],
      STATION_ROW_HEIGHT,
    );

    // Assert
    expect(offsets).toStrictEqual([0, 6 * STATION_ROW_HEIGHT]);
  });
});

describe('spyReduce: a tab tap holds the tab while its scroll runs', () => {
  const following: SpyState = { kind: 'following', section: 0 };

  it('follows the spy while nothing is held', () => {
    expect(spyReduce(following, { type: 'spy', section: 1, y: 450 })).toStrictEqual({ kind: 'following', section: 1 });
  });

  it('shows the tapped section at once and holds it until its scroll lands', () => {
    expect(spyReduce(following, { type: 'tap', section: 1, y: 400, fromY: 0 })).toStrictEqual({
      kind: 'held',
      section: 1,
      y: 400,
    });
  });

  it('ignores the sections the scroll passes on its way to the tapped one', () => {
    // Arrange
    const held: SpyState = { kind: 'held', section: 2, y: 900 };

    // Act & Assert
    expect(spyReduce(held, { type: 'spy', section: 0, y: 120 })).toBe(held);
    expect(spyReduce(held, { type: 'spy', section: 1, y: 500 })).toBe(held);
  });

  it('follows again once the scroll reaches the tapped section', () => {
    expect(spyReduce({ kind: 'held', section: 2, y: 900 }, { type: 'spy', section: 2, y: 900 })).toStrictEqual({
      kind: 'following',
      section: 2,
    });
  });

  it('follows again when the user drags the list, keeping the tab shown until the spy moves it', () => {
    // Act
    const released = spyReduce({ kind: 'held', section: 2, y: 900 }, { type: 'drag' });

    // Assert
    expect(released).toStrictEqual({ kind: 'following', section: 2 });
    expect(spyReduce(released, { type: 'spy', section: 1, y: 500 })).toStrictEqual({ kind: 'following', section: 1 });
  });

  it('keeps the same state when nothing changes, so the view does not re-render', () => {
    expect(spyReduce(following, { type: 'spy', section: 0, y: 10 })).toBe(following);
    expect(spyReduce(following, { type: 'drag' })).toBe(following);
    expect(spyReduce(following, { type: 'top' })).toBe(following);
  });

  it('keeps the tapped section once its clamped scroll lands, though the spy reads a later one there', () => {
    // Arrange: section 1 starts below the list's last scroll position, so the
    // tap scrolls to that position, where the spy reads the last section.
    const held = spyReduce(following, { type: 'tap', section: 1, y: 500, fromY: 0 });

    // Act
    const landed = spyReduce(held, { type: 'spy', section: 2, y: 500 });

    // Assert
    expect(landed).toStrictEqual({ kind: 'following', section: 1 });
  });

  it('follows at once when the tap needs no scroll, since no scroll event will release it', () => {
    expect(
      spyReduce({ kind: 'following', section: 2 }, { type: 'tap', section: 1, y: 500, fromY: 500 }),
    ).toStrictEqual({ kind: 'following', section: 1 });
  });

  it('follows the first section after a status-bar tap scrolls the list to the top', () => {
    // Arrange: the scroll to the top ran under the hold, so the spy was ignored.
    const held = spyReduce(following, { type: 'tap', section: 2, y: 900, fromY: 0 });
    const passing = spyReduce(held, { type: 'spy', section: 1, y: 450 });

    // Act
    const atTop = spyReduce(passing, { type: 'top' });

    // Assert
    expect(atTop).toStrictEqual({ kind: 'following', section: 0 });
  });
});

describe('tapScrollY', () => {
  it('scrolls to the section’s offset when the list can bring it to the top', () => {
    expect(tapScrollY(400, 2000, 600)).toBe(400);
  });

  it('stops at the end of the list rather than past it', () => {
    expect(tapScrollY(400, 800, 600)).toBe(200);
    expect(tapScrollY(400, 500, 600)).toBe(0);
  });

  it('scrolls to the offset before the list has been measured', () => {
    expect(tapScrollY(400, 0, 0)).toBe(400);
  });
});

describe('listBottomPadding: the footer that lets the last direction reach the top', () => {
  const row = STATION_ROW_HEIGHT;
  const base = 100;
  const viewport = 700;
  // The furthest a list of this body and padding scrolls, in `tapScrollY`'s terms.
  const maxScroll = (body: number, padding: number) => body + padding - viewport;

  it('pads a short line exactly enough for its last section to scroll to the top', () => {
    // Arrange: the HSSC shuttle's shape, 11 stops, the second direction from the 7th.
    const list = { viewport, body: 11 * row, sectionOffsets: [0, 6 * row] };

    // Act
    const padding = listBottomPadding(base, list);

    // Assert
    expect(maxScroll(list.body, padding)).toBe(6 * row);
    expect(tapScrollY(6 * row, list.body + padding, viewport)).toBe(6 * row);
  });

  it('adds nothing to a long line whose last section already fills the viewport', () => {
    const list = { viewport, body: 60 * row, sectionOffsets: [0, 30 * row] };

    expect(listBottomPadding(base, list)).toBe(base);
  });

  it('adds nothing to a line of one section, which has no tab to press', () => {
    const list = { viewport, body: 4 * row, sectionOffsets: [0] };

    expect(listBottomPadding(base, list)).toBe(base);
  });

  it('keeps what the sheet needs under the last row when that is more', () => {
    const list = { viewport, body: 11 * row, sectionOffsets: [0, 10 * row] };

    expect(listBottomPadding(viewport, list)).toBe(viewport);
  });

  it('is the base until both the viewport and the list are measured, so no viewport-tall gap flashes', () => {
    expect(listBottomPadding(base, { viewport: 0, body: 11 * row, sectionOffsets: [0, 6 * row] })).toBe(base);
    expect(listBottomPadding(base, { viewport, body: 0, sectionOffsets: [0, 6 * row] })).toBe(base);
  });
});

describe('tabPressScroll: a direction tab press moves the list, never the sheet', () => {
  it('holds the list at the section below the top detent, where the sheet locks the list', () => {
    expect(tabPressScroll(false, 900)).toStrictEqual({ kind: 'hold', y: 900 });
  });

  it('scrolls to the section at the top detent, where the list scrolls freely', () => {
    expect(tabPressScroll(true, 900)).toStrictEqual({ kind: 'scroll', y: 900 });
  });

  it('names no detent, so the press leaves the sheet where it is', () => {
    expect(Object.keys(tabPressScroll(false, 0)).sort()).toStrictEqual(['kind', 'y']);
    expect(Object.keys(tabPressScroll(true, 0)).sort()).toStrictEqual(['kind', 'y']);
  });
});
