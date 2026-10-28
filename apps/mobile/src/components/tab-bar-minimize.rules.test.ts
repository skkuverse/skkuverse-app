/**
 * When a scroll shrinks the tab bar and when it brings it back, including a
 * page whose offset rests below zero under iOS's automatic inset.
 */

import { describe, it, expect } from 'vitest';
import { DIRECTION_DEADBAND, EXPANDED, MINIMIZED, TOP_ZONE, clampedScrollY, decideHandOver, decideMinimize } from './tab-bar-minimize.rules';

/** A tall feed in a 700pt viewport. */
const feed = (offsetY: number, topInset = 0) => clampedScrollY({ offsetY, contentHeight: 3000, viewportHeight: 700, topInset });

describe('clampedScrollY', () => {
  it('is the offset itself for a page whose content starts at 0', () => {
    expect(feed(0)).toBe(0);
    expect(feed(150)).toBe(150);
  });

  it('reads the resting offset under an automatic header inset as the top, not as a point below it', () => {
    // Home on iOS 26: the ScrollView rests at minus its 140pt header.
    expect(feed(-140, 140)).toBe(0);
    expect(feed(-140 + 30, 140)).toBe(30);
  });

  it('holds a rubber band past the top at the top, so the snap back is no scroll up', () => {
    expect(feed(-80)).toBe(0);
    expect(feed(-200, 140)).toBe(0);
  });

  it('holds a rubber band past the bottom at the bottom', () => {
    expect(feed(2300)).toBe(2300);
    expect(feed(2400)).toBe(2300);
    expect(feed(2300 + 140 + 60, 140)).toBe(2300 + 140);
  });

  it('never goes negative for content shorter than the viewport', () => {
    expect(clampedScrollY({ offsetY: 40, contentHeight: 300, viewportHeight: 700, topInset: 0 })).toBe(0);
  });
});

describe('decideMinimize', () => {
  it('expands within the top zone, whichever way the scroll moves', () => {
    expect(decideMinimize(0, 10)).toBe(EXPANDED);
    expect(decideMinimize(TOP_ZONE - 1, 10)).toBe(EXPANDED);
  });

  it('minimizes on a scroll down past the deadband and expands on a scroll up past it', () => {
    expect(decideMinimize(300, DIRECTION_DEADBAND + 1)).toBe(MINIMIZED);
    expect(decideMinimize(300, -(DIRECTION_DEADBAND + 1))).toBe(EXPANDED);
  });

  it('leaves the bar alone for travel inside the deadband', () => {
    expect(decideMinimize(300, DIRECTION_DEADBAND)).toBeNull();
    expect(decideMinimize(300, -DIRECTION_DEADBAND)).toBeNull();
    expect(decideMinimize(300, 0)).toBeNull();
  });

  it('expands home on a scroll back to its automatic-inset rest, read through clampedScrollY', () => {
    // Deep in the feed, then a swipe up that returns to rest.
    const before = feed(-140 + 400, 140);
    const after = feed(-140, 140);
    expect(decideMinimize(after, after - before)).toBe(EXPANDED);
  });
});

describe('decideHandOver: a scroller that drives the bar only part of the time', () => {
  it('expands the bar when the scroller stops driving it, since nothing else would bring it back', () => {
    // Arrange
    const wasDriving = true;
    // Act
    const next = decideHandOver(wasDriving, false);
    // Assert
    expect(next).toBe(EXPANDED);
  });

  it('leaves the bar alone when the scroller starts driving it, until it scrolls', () => {
    expect(decideHandOver(false, true)).toBeNull();
  });

  it('leaves the bar alone while nothing changes', () => {
    expect(decideHandOver(true, true)).toBeNull();
    expect(decideHandOver(false, false)).toBeNull();
  });
});
