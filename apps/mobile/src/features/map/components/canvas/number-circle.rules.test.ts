/** The building number circle with and without a count, and the release gate. */

import { describe, expect, it } from 'vitest';
import { buildingCountsFor, numberCircleLook, toBadgeKey } from './number-circle.rules';

describe('numberCircleLook', () => {
  it('is the plain circle, exactly as before counts existed, with no count', () => {
    // Act & Assert: the release props, size square, hung by the bottom edge, tinted.
    expect(numberCircleLook(16, undefined)).toStrictEqual({ width: 16, height: 16, anchor: { x: 0.5, y: 1.0 }, badge: null });
    expect(numberCircleLook(20, undefined)).toStrictEqual({ width: 20, height: 20, anchor: { x: 0.5, y: 1.0 }, badge: null });
    expect(numberCircleLook(16, 0)).toStrictEqual(numberCircleLook(16, undefined));
  });

  it('keeps the circle where it was under a badge: same centre column, bottom edge on the coordinate', () => {
    // Act
    const look = numberCircleLook(16, 2);

    // Assert: a 24 canvas with the 16 circle centred puts its bottom 20 down.
    expect(look).toStrictEqual({ width: 24, height: 24, anchor: { x: 0.5, y: 20 / 24 }, badge: '2' });
    expect(numberCircleLook(32, 1).width).toBe(48);
  });

  it('spells counts to nine, then 9+', () => {
    // Act & Assert
    expect([1, 9, 10, 42].map(toBadgeKey)).toStrictEqual(['1', '9', '9p', '9p']);
  });
});

describe('buildingCountsFor: the release gate', () => {
  const counts = new Map([['12', 2]]);

  it('hands the layer nothing when the feed is not shown, whatever was published', () => {
    // Act
    const shown = buildingCountsFor(false, counts);

    // Assert
    expect(shown.size).toBe(0);
    expect(buildingCountsFor(false, new Map())).toBe(shown);
  });

  it('hands the layer the published counts when the feed is shown', () => {
    // Act & Assert
    expect(buildingCountsFor(true, counts)).toBe(counts);
    expect(buildingCountsFor(true, new Map()).size).toBe(0);
  });
});
