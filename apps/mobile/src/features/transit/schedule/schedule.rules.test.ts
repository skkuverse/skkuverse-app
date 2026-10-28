import { describe, expect, it } from 'vitest';
import { decideStopDotTone, type DecideStopDotToneInputs } from './schedule.rules';

const dot = (overrides: Partial<DecideStopDotToneInputs>) =>
  decideStopDotTone({ layout: 'v1', isToday: true, isNext: false, past: false, hollow: false, ...overrides });

describe('decideStopDotTone: the v1 timetable', () => {
  it("today, a past stop greys, the next run's stops take the accent, and the rest are upcoming", () => {
    expect(dot({ past: true })).toBe('past');
    expect(dot({ isNext: true })).toBe('next');
    expect(dot({ isNext: true, hollow: true })).toBe('next');
    expect(dot({})).toBe('upcoming');
  });

  it('another day dims every dot, whatever the run', () => {
    expect(dot({ isToday: false })).toBe('otherDay');
    expect(dot({ isToday: false, isNext: true })).toBe('otherDay');
    expect(dot({ isToday: false, past: true, hollow: true })).toBe('otherDay');
  });
});

describe('decideStopDotTone: the sectioned timetable', () => {
  const sectioned = (overrides: Partial<DecideStopDotToneInputs>) => dot({ layout: 'sectioned', ...overrides });

  it("a past stop greys, and only the next run's boarding dots take the accent", () => {
    expect(sectioned({ past: true })).toBe('past');
    expect(sectioned({ past: true, isNext: true })).toBe('past');
    expect(sectioned({ isNext: true })).toBe('next');
    expect(sectioned({ isNext: true, hollow: true })).toBe('upcoming');
    expect(sectioned({})).toBe('upcoming');
  });

  it('another day keeps its dots upcoming rather than dimmed', () => {
    expect(sectioned({ isToday: false })).toBe('upcoming');
  });
});
