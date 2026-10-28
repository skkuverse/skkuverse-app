/**
 * The floating tab bar's geometry per device shape: where the capsule sits,
 * what a page clears, how the cells, the lens and the glyphs fall, from the
 * insets and window width alone.
 */

import { describe, it, expect } from 'vitest';
import { BAR_HEIGHT, BAR_PAD, LENS_HEIGHT, MINIMIZED_SCALE, indexAtX, lensLeft, tabBarGeometry } from './geometry.rules';

const FOUR = 4;

/** The device shapes the bar has to cover; a new one is a row here. */
const DEVICES = {
  // A home-indicator iPhone, portrait: the 17 Pro, the 17, the 17e, the Air.
  iPhone17Pro: { insets: { left: 0, right: 0, bottom: 34 }, width: 402 },
  // A home-indicator iPhone in landscape: the sensor housing's 59pt on both sides, 21pt under.
  iPhone17ProLandscape: { insets: { left: 59, right: 59, bottom: 21 }, width: 874 },
  // An iPhone without a home indicator (iOS 26 drops none; listed for the rule).
  homeButtonIPhone: { insets: { left: 0, right: 0, bottom: 0 }, width: 375 },
  // An iPad in portrait: UIKit's 20pt home-indicator inset (ADR 0023 keeps the phone bar on iPad).
  iPadPortrait: { insets: { left: 0, right: 0, bottom: 20 }, width: 834 },
  // Android, gesture navigation: the gesture bar, about 24dp.
  androidGesture: { insets: { left: 0, right: 0, bottom: 24 }, width: 411 },
  // Android, three-button navigation, edge to edge: the 48dp button bar.
  androidThreeButton: { insets: { left: 0, right: 0, bottom: 48 }, width: 411 },
} as const;

const geometryOf = (device: keyof typeof DEVICES) => tabBarGeometry(DEVICES[device].insets, DEVICES[device].width, FOUR);

describe('tabBarGeometry: the capsule frame', () => {
  it('floats 21pt from the sides and 13pt into a home indicator’s safe area', () => {
    expect(geometryOf('iPhone17Pro').frame).toStrictEqual({ left: 21, right: 21, bottom: 21, width: 360, height: 62 });
  });

  it('keeps 21pt from the bottom of a device whose inset is shallower than 34pt', () => {
    for (const device of ['homeButtonIPhone', 'iPadPortrait', 'androidGesture'] as const) {
      expect(geometryOf(device).frame.bottom, device).toBe(21);
    }
    expect(geometryOf('homeButtonIPhone').frame.width).toBe(375 - 42);
    expect(geometryOf('iPadPortrait').frame.width).toBe(834 - 42);
  });

  it('clears a deeper inset by the same 13pt (Android three-button navigation)', () => {
    expect(geometryOf('androidThreeButton').frame.bottom).toBe(35);
  });

  it('adds the side insets in full (a landscape sensor housing)', () => {
    const { frame } = geometryOf('iPhone17ProLandscape');
    expect(frame).toStrictEqual({ left: 80, right: 80, bottom: 21, width: 874 - 160, height: 62 });
  });
});

describe('tabBarGeometry: what a page clears', () => {
  it('is the capsule’s top edge, 83pt on an iPhone 17 Pro, the figure the native bar’s safe area gave the sheets', () => {
    expect(geometryOf('iPhone17Pro').inset).toBe(83);
  });

  it('is 83pt on every listed device but Android’s button bar, which pushes it to 97dp', () => {
    for (const device of ['iPhone17ProLandscape', 'homeButtonIPhone', 'iPadPortrait', 'androidGesture'] as const) {
      expect(geometryOf(device).inset, device).toBe(83);
    }
    expect(geometryOf('androidThreeButton').inset).toBe(97);
  });

  it('is always deeper than the safe area itself, so no device falls back to it', () => {
    for (const bottom of [0, 20, 24, 34, 48, 60]) {
      const g = tabBarGeometry({ left: 0, right: 0, bottom }, 402, FOUR);
      expect(g.inset).toBeGreaterThan(bottom);
      expect(g.inset).toBe(g.frame.bottom + g.frame.height);
    }
  });

  it('is the expanded figure: the minimized capsule shrinks into it about its centre', () => {
    const g = geometryOf('iPhone17Pro');
    expect(g.minimizedScale).toBe(MINIMIZED_SCALE);
    expect(g.minimizedTopDrop).toBeCloseTo((BAR_HEIGHT * (1 - 0.84)) / 2, 6);
    expect(g.minimizedTopDrop).toBeLessThan(g.frame.height / 2);
  });
});

describe('tabBarGeometry: cells, lens and glyphs on an iPhone 17 Pro', () => {
  const g = geometryOf('iPhone17Pro');

  it('tiles the capsule wall to wall with four equal cells and no gap', () => {
    expect(g.cells).toHaveLength(4);
    expect(g.cells[0]?.left).toBe(0);
    for (const [i, cell] of g.cells.entries()) {
      expect(cell.width).toBe(90);
      const previous = g.cells[i - 1];
      if (previous) expect(cell.left).toBe(previous.left + previous.width);
    }
    const last = g.cells[g.cells.length - 1];
    expect((last?.left ?? 0) + (last?.width ?? 0)).toBe(g.frame.width);
  });

  it('puts the four lenses where the iOS 26.5 bar draws them (left edges 25, 110, 194, 279; width 98)', () => {
    expect(g.pad).toBe(BAR_PAD);
    expect(g.innerWidth).toBe(352);
    expect(g.lens.width).toBeCloseTo(98, 6);
    expect(g.lens.height).toBe(LENS_HEIGHT);
    expect(g.lens.top).toBe(BAR_PAD);
    const lefts = [0, 1, 2, 3].map((index) => g.frame.left + g.pad + lensLeft(g, index));
    expect(lefts.map((x) => Math.round(x))).toStrictEqual([25, 110, 194, 279]);
  });

  it('sits the first lens flush left and the last flush right', () => {
    expect(lensLeft(g, 0)).toBe(0);
    expect(lensLeft(g, 3) + g.lens.width).toBeCloseTo(g.innerWidth, 6);
  });

  it('leans the outer tabs’ glyphs inward, to the centre of their overlapping frame', () => {
    expect(g.glyphOffsets.map((o) => Number(o.toFixed(2)))).toStrictEqual([8, 2.67, -2.67, -8]);
  });
});

describe('tabBarGeometry: the lens on other tab counts', () => {
  it('overlaps three tabs by 8pt per gap and five by 33pt in all', () => {
    const three = tabBarGeometry(DEVICES.iPhone17Pro.insets, DEVICES.iPhone17Pro.width, 3);
    expect(three.lens.width).toBeCloseTo((352 + 16) / 3, 6);
    const five = tabBarGeometry(DEVICES.iPhone17Pro.insets, DEVICES.iPhone17Pro.width, 5);
    expect(five.lens.width).toBeCloseTo((352 + 33) / 5, 6);
  });

  it('never exceeds the inner width', () => {
    const one = tabBarGeometry({ left: 0, right: 0, bottom: 0 }, 100, 1);
    expect(one.lens.width).toBe(one.innerWidth);
    expect(one.lens.pitch).toBe(0);
  });
});

describe('indexAtX', () => {
  const g = geometryOf('iPhone17Pro');
  /** Where tab `index`'s lens rests, its centre from the capsule's left wall. */
  const lensCentre = (index: number) => g.pad + lensLeft(g, index) + g.lens.width / 2;

  it('is the tab’s index with the finger on its resting lens centre, so the lens centres on the finger', () => {
    for (const index of [0, 1, 2, 3]) {
      expect(indexAtX(lensCentre(index), g)).toBeCloseTo(index, 6);
    }
    // The outer lenses rest 53pt and 307pt from the wall, inside their 90pt cells' centres (45 and 315).
    expect(lensCentre(0)).toBeCloseTo(53, 6);
    expect(lensCentre(3)).toBeCloseTo(307, 6);
  });

  it('moves continuously between two centres, crossing to the next tab halfway', () => {
    expect(indexAtX((lensCentre(0) + lensCentre(1)) / 2, g)).toBeCloseTo(0.5, 6);
  });

  it('clamps to the first and last tab past the capsule’s edges', () => {
    expect(indexAtX(-50, g)).toBe(0);
    expect(indexAtX(0, g)).toBe(0);
    expect(indexAtX(g.frame.width, g)).toBe(3);
    expect(indexAtX(1000, g)).toBe(3);
  });

  it('is 0 for a single tab, whose lens has no pitch', () => {
    const one = tabBarGeometry({ left: 0, right: 0, bottom: 0 }, 100, 1);
    expect(indexAtX(50, one)).toBe(0);
  });
});
