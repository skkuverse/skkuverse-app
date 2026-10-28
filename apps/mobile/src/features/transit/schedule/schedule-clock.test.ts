/**
 * The timetable judges "next" and "past" on the KST clock, from the epoch, so
 * a phone set to another zone marks the same runs a phone in Seoul does
 * (spec transit/bus-schedule). Only the device zone and the time are set.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { kstDate } from '@skkuverse/shared';
import { getNextBus, isPastBus, isPastTime } from './schedule.rules';
import type { BusService, ScheduleEntry } from '../transit.types';

const ORIGINAL_TZ = process.env.TZ;

// 2026-10-19T00:00:00+09:00, written as UTC.
const KST_MIDNIGHT = Date.UTC(2026, 9, 18, 15, 0, 0);
const atKst = (hh: number, mm: number) => KST_MIDNIGHT + (hh * 60 + mm) * 60_000;

function run(time: string, stopTimes?: (string | null)[]): ScheduleEntry {
  return { index: 0, time, routeType: 'r', busCount: 1, crowding: 'unknown', stopTimes };
}

beforeAll(() => {
  process.env.TZ = 'America/New_York';
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('the timetable clock', () => {
  it('runs in a zone other than KST', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).not.toBe(-540);
  });

  it('at 08:05 KST, 08:10 is next and 08:00 is past', () => {
    // Arrange
    const now = atKst(8, 5);
    vi.setSystemTime(now);
    const entries = [run('08:00'), run('08:10'), run('08:20')];

    // Act
    const next = getNextBus(entries, true, undefined, now);

    // Assert
    expect(next?.time).toBe('08:10');
    expect(isPastBus(entries[0], true, undefined, now)).toBe(true);
    expect(isPastBus(entries[1], true, undefined, now)).toBe(false);
  });

  it('at 00:30 KST, the day is the KST day and the 07:30 run is next with none past', () => {
    // Arrange
    const now = atKst(0, 30);
    vi.setSystemTime(now);
    const entries = [run('07:30'), run('08:00')];

    // Act
    const next = getNextBus(entries, true, undefined, now);

    // Assert
    expect(kstDate(now)).toBe('2026-10-19');
    expect(next?.time).toBe('07:30');
    expect(entries.some((entry) => isPastBus(entry, true, undefined, now))).toBe(false);
  });

  it('at 08:20 KST, a run boarding last at 08:25 is not past, and its 08:15 line is', () => {
    // Arrange
    const now = atKst(8, 20);
    vi.setSystemTime(now);
    const sequences: BusService['stopSequences'] = {
      r: [
        { label: 'A', action: 'board', timing: 'scheduled' },
        { label: 'B', action: 'board', timing: 'scheduled' },
        { label: 'C', action: 'board', timing: 'scheduled' },
      ],
    };
    const entry = run('08:00', ['08:00', '08:15', '08:25']);

    // Act
    const runPast = isPastBus(entry, true, sequences, now);
    const linePast = isPastTime('08:15', true, now);

    // Assert
    expect(runPast).toBe(false);
    expect(linePast).toBe(true);
  });
});
