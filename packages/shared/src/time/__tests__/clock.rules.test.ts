/**
 * The clock's scheduling (spec platform/device-clock): where the next aligned
 * tick falls, and how long one timer may wait for an edge.
 */
import { describe, expect, it } from 'vitest';
import { MAX_TIMER_DELAY_MS, toAlignedEdge, toArmDelay } from '../clock.rules';

describe('toAlignedEdge', () => {
  it.each([
    ['on a boundary, the next one', 60_000, 30_000, 90_000],
    ['just after a boundary, the next one', 60_001, 30_000, 90_000],
    ['just before a boundary, that one', 89_999, 30_000, 90_000],
    ['at zero, one period later', 0, 30_000, 30_000],
    ['period 1, the next millisecond', 1_234, 1, 1_235],
    ['a fractional now, the boundary after it', 1_234.5, 1, 1_235],
    ['a minute, on the wall-clock minute', 1_700_000_012_345, 60_000, 1_700_000_040_000],
  ])('%s', (_name, now, everyMs, expected) => {
    // Act
    const edge = toAlignedEdge(now, everyMs);

    // Assert
    expect(edge).toBe(expected);
  });

  it.each([
    ['a zero period', 0],
    ['a negative period', -30_000],
    ['a non-finite period', Number.NaN],
  ])('%s has no edge', (_name, everyMs) => {
    // Act & Assert
    expect(toAlignedEdge(60_000, everyMs)).toBeNull();
  });
});

describe('toArmDelay', () => {
  it.each([
    ['an edge ahead, the gap', 1_500, 1_000, 500],
    ['an edge now, zero', 1_000, 1_000, 0],
    ['a past edge, clamped at zero', 500, 1_000, 0],
    ['an edge 40 days away, capped at the timer maximum', 40 * 86_400_000, 0, MAX_TIMER_DELAY_MS],
    ['an edge exactly at the maximum, the maximum', MAX_TIMER_DELAY_MS, 0, MAX_TIMER_DELAY_MS],
  ])('%s', (_name, edge, now, expected) => {
    // Act
    const delay = toArmDelay(edge, now);

    // Assert
    expect(delay).toBe(expected);
  });

  it('caps at the largest delay setTimeout honours, a signed 32-bit int', () => {
    // Act & Assert
    expect(MAX_TIMER_DELAY_MS).toBe(2 ** 31 - 1);
  });
});
