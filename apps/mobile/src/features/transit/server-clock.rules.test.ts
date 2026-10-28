import { describe, expect, it } from 'vitest';
import { CLOCK_SAMPLES, addClockSample, clockOffsetOf, receiptOf } from './server-clock.rules';

describe('clockOffsetOf', () => {
  it('reads no offset before any sample', () => {
    expect(clockOffsetOf([])).toBe(0);
  });

  it('takes the largest sample, since a slow or cached response only reads low', () => {
    expect(clockOffsetOf([1_200, -8_000, 900])).toBe(1_200);
    expect(clockOffsetOf([-3_000, -2_500])).toBe(-2_500);
  });
});

describe('addClockSample', () => {
  it('keeps only the most recent samples, so a changed device clock is followed', () => {
    let samples: number[] = [];
    for (let i = 0; i < CLOCK_SAMPLES; i++) samples = addClockSample(samples, 60_000);
    for (let i = 0; i < CLOCK_SAMPLES; i++) samples = addClockSample(samples, 0);
    expect(samples.length).toBe(CLOCK_SAMPLES);
    expect(clockOffsetOf(samples)).toBe(0);
  });
});

describe('receiptOf: when an answer arrived (review F1)', () => {
  const S = Date.parse('2026-10-24T04:24:13.000Z');
  const T0 = S + 300;

  it('stamps a first answer with the time it arrived', () => {
    // Act & Assert
    expect(receiptOf(undefined, S, T0)).toBe(T0);
  });

  it('stamps an answer the HTTP cache replays with its original\u2019s arrival, so the offset never reads low by its age', () => {
    // Arrange: the same serverNow, 4 s later, inside the response's max-age=5.
    const held = { serverNowMs: S, receivedAtMs: T0 };

    // Act
    const replayed = receiptOf(held, S, T0 + 4_000);

    // Assert
    expect(replayed).toBe(T0);
    expect(clockOffsetOf([S - replayed])).toBe(-300);
  });

  it('stamps a fresh answer, a new serverNow, with its own arrival', () => {
    // Act & Assert
    expect(receiptOf({ serverNowMs: S, receivedAtMs: T0 }, S + 10_000, T0 + 10_000)).toBe(T0 + 10_000);
  });

  it('stamps an answer with no server clock with its own arrival', () => {
    // Act & Assert
    expect(receiptOf({ receivedAtMs: T0 }, undefined, T0 + 4_000)).toBe(T0 + 4_000);
  });
});
