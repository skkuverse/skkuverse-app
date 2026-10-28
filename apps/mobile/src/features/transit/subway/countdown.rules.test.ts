import { describe, it, expect } from 'vitest';
import { countdown, trackPosition, trainTime } from './countdown.rules';

describe('countdown', () => {
  const now = Date.parse('2026-10-17T02:40:00.000Z');

  it('reads whole minutes, rounded down so a train never seems later than it is', () => {
    expect(countdown(now + 5 * 60_000 + 50_000, now)).toEqual({ kind: 'in', minutes: 5 });
    expect(countdown(now + 10 * 60_000, now)).toEqual({ kind: 'in', minutes: 10 });
  });

  it('reads one minute from 60 s up to two minutes', () => {
    expect(countdown(now + 60_000, now)).toEqual({ kind: 'in', minutes: 1 });
    expect(countdown(now + 119_000, now)).toEqual({ kind: 'in', minutes: 1 });
  });

  it('says arriving under a minute, since the estimate is no finer than that', () => {
    expect(countdown(now + 59_000, now)).toEqual({ kind: 'arriving' });
  });

  it('says arriving once the time is up, and never a negative time', () => {
    expect(countdown(now, now)).toEqual({ kind: 'arriving' });
    expect(countdown(now - 30_000, now)).toEqual({ kind: 'arriving' });
  });
});

describe('countdown from an hour away: the clock time instead of minutes', () => {
  // 12:40 KST on 2026-10-17.
  const now = Date.parse('2026-10-17T03:40:00.000Z');

  it('still reads minutes at 59 minutes', () => {
    // Act & Assert
    expect(countdown(now + 59 * 60_000 + 59_000, now)).toEqual({ kind: 'in', minutes: 59 });
  });

  it('reads the KST clock time at exactly 60 minutes', () => {
    // Act & Assert
    expect(countdown(now + 60 * 60_000, now)).toEqual({ kind: 'at', time: '13:40' });
  });

  it('reads the KST time from the epoch, zero-padded, whatever the device zone', () => {
    // Arrange: 05:32 KST is 20:32 UTC the day before.
    const early = Date.parse('2026-10-16T20:32:00.000Z');

    // Act & Assert
    expect(countdown(early, early - 3 * 3_600_000)).toEqual({ kind: 'at', time: '05:32' });
  });

  it('crosses midnight: 23:30 now and a train at 00:40 reads 00:40', () => {
    // Arrange
    const late = Date.parse('2026-10-17T14:30:00.000Z');

    // Act & Assert
    expect(countdown(late + 70 * 60_000, late)).toEqual({ kind: 'at', time: '00:40' });
  });
});

describe('trainTime: the day\u2019s first train (ADR 0022 d4)', () => {
  // 04:20 KST on 2026-10-24, before the first trains through 혜화 (05:20 to 06:00).
  const now = Date.parse('2026-10-23T19:20:00.000Z');
  const first = (arrivalAt: number) => ({ arrivalAt, isFirstRun: true });
  const regular = (arrivalAt: number) => ({ arrivalAt, isFirstRun: false });

  it('reads a first train an hour or more away as its clock time, labelled the first train', () => {
    // Arrange: 05:32 KST, 72 minutes away.
    const at = Date.parse('2026-10-23T20:32:00.000Z');

    // Act & Assert
    expect(trainTime(first(at), now)).toEqual({ countdown: { kind: 'at', time: '05:32' }, firstTrain: 'label' });
    expect(trainTime(first(now + 60 * 60_000), now)).toEqual({ countdown: { kind: 'at', time: '05:20' }, firstTrain: 'label' });
  });

  it('keeps the minutes of a first train under an hour away, with the first-train badge beside them', () => {
    // Act & Assert
    expect(trainTime(first(now + 59 * 60_000), now)).toEqual({ countdown: { kind: 'in', minutes: 59 }, firstTrain: 'badge' });
    expect(trainTime(first(now + 12 * 60_000 + 30_000), now)).toEqual({ countdown: { kind: 'in', minutes: 12 }, firstTrain: 'badge' });
  });

  it('keeps the badge on a first train that is arriving', () => {
    // Act & Assert
    expect(trainTime(first(now + 30_000), now)).toEqual({ countdown: { kind: 'arriving' }, firstTrain: 'badge' });
  });

  it('marks nothing on a train that is not the first, however far away', () => {
    // Act & Assert
    expect(trainTime(regular(now + 5 * 60_000), now)).toEqual({ countdown: { kind: 'in', minutes: 5 }, firstTrain: null });
    expect(trainTime(regular(now + 90 * 60_000), now)).toEqual({ countdown: { kind: 'at', time: '05:50' }, firstTrain: null });
  });
});

describe('trackPosition', () => {
  const now = Date.parse('2026-10-17T02:40:00.000Z');
  const window = 6 * 60_000;

  it('places a train by the share of the window still to run, the station at 1', () => {
    expect(trackPosition(now + 3 * 60_000, now, window)).toBe(0.5);
    expect(trackPosition(now + 90_000, now, window)).toBe(0.75);
  });

  it('holds a train further out than the window at the left end', () => {
    expect(trackPosition(now + 20 * 60_000, now, window)).toBe(0);
  });

  it('puts a train that is due at the station', () => {
    expect(trackPosition(now, now, window)).toBe(1);
    expect(trackPosition(now - 30_000, now, window)).toBe(1);
  });
});
