/**
 * Bus marker geometry.
 *
 * Why this file exists: "the marker overshoots the last stop" was fixed in
 * 80e994f (2026-04) and silently undone by a merge-conflict resolution in
 * bf3cb6d. These cases are the definition of "never past the end of the
 * line", and of a loop's last section, which is the one way past it.
 */

import { describe, expect, it } from 'vitest';
import {
  ASSUMED_SPEED_MPS,
  CHASE_SHARE,
  FREEZE_AFTER_MS,
  LEAP_PT,
  MAX_TRACKED_PROGRESS,
  PRE_DEPARTURE_CAP,
  PULSE_SIZE,
  RESET_DROP_PT,
  SLOW_AFTER_MS,
  STATION_ROW_HEIGHT,
  agedOffsetMs,
  dotCenterY,
  markerTarget,
  markerTop,
  planMarker,
  planTrajectoryMarker,
  shouldSnap,
  SNAP_AFTER_MS,
  FRESH_POLL_WAIT_MS,
  isAwaitingFreshPoll,
  resumedAt,
  trackedProgress,
  trajectoryS,
  type LineShape,
  type MarkerPlan,
} from './marker-geometry.rules';
import type { TrajectoryKnot, VehiclePosition } from '../transit.types';

const center = (top: number) => top + PULSE_SIZE / 2;

const SEEN = 1_000_000;

function position(fields: Partial<VehiclePosition>): VehiclePosition {
  return {
    stationIndex: 9,
    status: 'inTransit',
    progress: null,
    sectionMeters: null,
    nextStationAtMs: null,
    positionAtMs: SEEN,
    checkedAtMs: SEEN,
    ...fields,
  };
}

const LINE: LineShape = { lastStationIndex: 20, isLoop: false };
/** HSSC: 11 stations, the last one leading back to 농구장. */
const LOOP: LineShape = { lastStationIndex: 10, isLoop: true };

describe('markerTop', () => {
  it('puts a whole s on its stop\'s dot, a row further per stop', () => {
    expect(center(markerTop(9, LINE))).toBe(dotCenterY(9));
    expect(center(markerTop(9.5, LINE))).toBe(dotCenterY(9) + STATION_ROW_HEIGHT / 2);
  });

  it('never places a marker past the last dot of a line, or above the first', () => {
    expect(center(markerTop(20.7, LINE))).toBe(dotCenterY(20));
    expect(center(markerTop(99, LINE))).toBe(dotCenterY(20));
    expect(center(markerTop(-1, LINE))).toBe(dotCenterY(0));
  });

  it('runs a loop\'s last section on below its last dot, and wraps a completed lap to station 0', () => {
    expect(center(markerTop(10.5, LOOP))).toBe(dotCenterY(10) + STATION_ROW_HEIGHT / 2);
    expect(center(markerTop(11, LOOP))).toBe(dotCenterY(0));
    expect(center(markerTop(11.25, LOOP))).toBe(dotCenterY(0.25));
  });
});

describe('trackedProgress', () => {
  it('is 0 for a bus at a stop or waiting', () => {
    expect(trackedProgress(position({ status: 'atStop', progress: 0.5 }), SEEN + 5_000)).toBe(0);
    expect(trackedProgress(position({ status: 'waitingToDepart' }), SEEN + 5_000)).toBe(0);
  });

  it('closes the rest of the section linearly until the next stop\'s time', () => {
    // Arrange
    const p = position({ progress: 0.2, nextStationAtMs: SEEN + 100_000 });

    // Assert
    expect(trackedProgress(p, SEEN + 50_000)).toBeCloseTo(0.6);
  });

  it('starts a stop-event bus (no measured progress) from its stop', () => {
    expect(trackedProgress(position({ nextStationAtMs: SEEN + 60_000 }), SEEN + 30_000)).toBeCloseTo(0.5);
  });

  it('predicts the time to the next stop from the section length when the source gave none', () => {
    // Arrange
    const p = position({ progress: 0.5, sectionMeters: 200 });
    const toNext = (100 / ASSUMED_SPEED_MPS) * 1000;

    // Assert
    expect(trackedProgress(p, SEEN + toNext / 2)).toBeCloseTo(0.75);
  });

  it('holds the served progress when there is neither a time nor a section length', () => {
    expect(trackedProgress(position({ progress: 0.4 }), SEEN + 60_000)).toBe(0.4);
  });

  it('never reaches the next stop before the server says the bus is there', () => {
    expect(trackedProgress(position({ progress: 0.3, nextStationAtMs: SEEN + 60_000 }), SEEN + 600_000)).toBe(
      MAX_TRACKED_PROGRESS,
    );
  });

  it('never moves a bus backward from its served progress', () => {
    expect(trackedProgress(position({ progress: 0.97, nextStationAtMs: SEEN + 10_000 }), SEEN)).toBe(0.97);
  });
});

describe('planMarker', () => {
  const SPREAD = 40_000;
  const T0 = 5_000_000;
  const ROW = STATION_ROW_HEIGHT;

  /** Plans `targets` (top at each time) one after another; returns every step. */
  function run(steps: [nowMs: number, targetTop: number][]): MarkerPlan[] {
    const plans: MarkerPlan[] = [];
    let state: MarkerPlan['state'] | undefined;
    for (const [nowMs, targetTop] of steps) {
      const plan = planMarker(state, targetTop, nowMs, SPREAD);
      plans.push(plan);
      state = plan.state;
    }
    return plans;
  }

  it('places a new marker where it is, without a glide', () => {
    const [first] = run([[T0, 300]]);
    expect(first!.top).toBe(300);
    expect(first!.glide).toBe(false);
  });

  it('follows a bus that moves a little each second at once, with no lag', () => {
    const plans = run([[T0, 300], [T0 + 1000, 303], [T0 + 2000, 306]]);
    expect(plans.map((p) => [p.top, p.glide])).toStrictEqual([[300, false], [303, true], [306, true]]);
  });

  it('spreads a leap to the next stop over the time until the next poll, never jumping', () => {
    const plans = run([
      [T0, 300],
      [T0 + 1000, 300 + ROW],
      [T0 + 1000 + SPREAD / 2, 300 + ROW],
      [T0 + 1000 + SPREAD, 300 + ROW],
    ]);
    expect(plans[1]!.top, 'the leap starts from where the marker is').toBe(300);
    expect(plans[2]!.top).toBe(300 + ROW / 2);
    expect(plans[3]!.top).toBe(300 + ROW);
    expect(plans.slice(1).every((p) => p.glide)).toBeTruthy();
  });

  it('keeps following a moving bus while it pays off a leap', () => {
    const plans = run([
      [T0, 300],
      [T0 + 1000, 300 + ROW],
      [T0 + 1000 + SPREAD / 2, 300 + ROW + 10],
    ]);
    expect(plans[2]!.top).toBe(300 + ROW / 2 + 10);
  });

  it('re-plans from where the marker is when a second leap comes mid-way', () => {
    const plans = run([
      [T0, 300],
      [T0 + 1000, 300 + ROW],
      [T0 + 1000 + SPREAD / 2, 300 + 2 * ROW],
      [T0 + 1000 + SPREAD, 300 + 2 * ROW],
    ]);
    const mid = 300 + ROW / 2;
    expect(plans[2]!.top).toBe(mid);
    expect(plans[3]!.top).toBe(mid + (300 + 2 * ROW - mid) / 2);
  });

  it('glides back onto a stop the bus is confirmed standing at, behind the marker (HSSC layover, 2026-10-23)', () => {
    // Arrange: drawn most of the way to 학생회관, then served laying over at 농구장
    const [ahead] = run([[T0, 300 + ROW * 0.95]]);

    // Act
    const back = planMarker(ahead!.state, 300, T0 + 1000, SPREAD, true);

    // Assert
    expect(back).toMatchObject({ top: 300, glide: true });
  });

  it('still spreads a leap forward onto a stop the bus stands at', () => {
    // Arrange
    const [first] = run([[T0, 300]]);

    // Act
    const next = planMarker(first!.state, 300 + ROW, T0 + 1000, SPREAD, true);

    // Assert
    expect(next.top).toBeLessThan(300 + LEAP_PT);
  });

  it('holds instead of sliding back for a small correction (an estimate that ran ahead)', () => {
    const plans = run([[T0, 300], [T0 + 1000, 280], [T0 + 2000, 290], [T0 + 3000, 305]]);
    expect(plans.map((p) => p.top)).toStrictEqual([300, 300, 300, 305]);
  });

  it('starts over without a glide when the bus begins a new trip far back up the line', () => {
    const plans = run([[T0, 2000], [T0 + 1000, 19]]);
    expect(plans[1]!.top).toBe(19);
    expect(plans[1]!.glide).toBe(false);
    expect(RESET_DROP_PT >= ROW * 2).toBeTruthy();
  });

  it('counts only a step bigger than a second of driving as a leap', () => {
    expect(LEAP_PT > 66 / 15, 'a 15 s segment moves less than a leap each second').toBeTruthy();
    expect(LEAP_PT < ROW / 2).toBeTruthy();
  });
});

describe('trajectoryS', () => {
  const T = 1_000_000;
  const knots = [
    { atMs: T, s: 4 },
    { atMs: T + 15_000, s: 4 },
    { atMs: T + 75_000, s: 5 },
    { atMs: T + 75_000, s: 5 },
    { atMs: T + 135_000, s: 6 },
  ];

  it('holds before the first knot and after the last', () => {
    expect(trajectoryS(knots, T - 60_000)).toBe(4);
    expect(trajectoryS(knots, T + 999_000)).toBe(6);
  });

  it('stays put through a dwell, then runs linearly between knots', () => {
    expect(trajectoryS(knots, T + 10_000)).toBe(4);
    expect(trajectoryS(knots, T + 45_000)).toBe(4.5);
    expect(trajectoryS(knots, T + 105_000)).toBe(5.5);
  });

  it('reads two knots at the same time without dividing by zero', () => {
    expect(trajectoryS(knots, T + 75_000)).toBe(5);
    expect(trajectoryS([{ atMs: T, s: 3 }, { atMs: T, s: 3 }], T)).toBe(3);
  });
});

describe('agedOffsetMs', () => {
  it('runs at real time while the row is fresh, half speed after, and stops at the freeze', () => {
    expect(agedOffsetMs(30_000)).toBe(30_000);
    expect(agedOffsetMs(SLOW_AFTER_MS)).toBe(SLOW_AFTER_MS);
    expect(agedOffsetMs(SLOW_AFTER_MS + 20_000)).toBe(SLOW_AFTER_MS + 10_000);
    const frozen = agedOffsetMs(FREEZE_AFTER_MS);
    expect(agedOffsetMs(FREEZE_AFTER_MS + 600_000)).toBe(frozen);
  });

  it('keeps a healthy row (up to ~120 s old on screen) at full speed', () => {
    expect(SLOW_AFTER_MS >= 120_000).toBeTruthy();
    expect(FREEZE_AFTER_MS > SLOW_AFTER_MS).toBeTruthy();
  });
});

describe('markerTarget', () => {
  const running = position({ stationIndex: 9, progress: 0.4 });
  const PATH: TrajectoryKnot[] = [
    { atMs: SEEN, s: 9.4 },
    { atMs: SEEN + 30_000, s: 10 },
    { atMs: SEEN + 90_000, s: 11 },
  ];
  const DWELL: TrajectoryKnot[] = [
    { atMs: SEEN, s: 9 },
    { atMs: SEEN + 15_000, s: 9 },
    { atMs: SEEN + 75_000, s: 10 },
  ];
  /** The target `sec` after the check, the lookahead taken off so `sec` is when the glide lands. */
  const at = (
    p: VehiclePosition,
    path: TrajectoryKnot[] | null,
    sec: number,
    line: LineShape = LINE,
  ) => markerTarget(p, path, line, SEEN + sec * 1000 - 1000);

  it('reads the path where the glide will land', () => {
    expect(at(running, PATH, 15)).toStrictEqual({
      s: expect.closeTo(9.7) as number,
      dimmed: false,
      following: true,
      standing: false,
    });
  });

  it('never reaches the next stop before a poll confirms it', () => {
    expect(at(running, PATH, 60).s).toBe(9 + MAX_TRACKED_PROGRESS);
  });

  it('holds a stopped bus on its dot through the dwell, then lets it edge out only a quarter', () => {
    const standing = position({ status: 'atStop' });
    expect(at(standing, DWELL, 10).s).toBe(9);
    expect(at(standing, DWELL, 70).s).toBe(9 + PRE_DEPARTURE_CAP);
  });

  it('never draws the bus behind its confirmed stop', () => {
    expect(at(position({ stationIndex: 10 }), PATH, 0).s).toBe(10);
  });

  it('pins a bus waiting to depart on its stop, whatever its path, as standing there', () => {
    expect(at(position({ status: 'waitingToDepart' }), PATH, 60)).toMatchObject({
      s: 9,
      following: false,
      standing: true,
    });
  });

  it('places a bus without a path by its progress, and one standing without a path on its dot', () => {
    expect(at(position({ progress: 0.5 }), null, 0)).toStrictEqual({
      s: 9.5,
      dimmed: false,
      following: false,
      standing: false,
    });
    expect(at(position({ status: 'atStop' }), null, 30)).toMatchObject({ s: 9, standing: true });
  });

  it('never reads a bus on its path as standing, even at its stop', () => {
    expect(at(position({ status: 'atStop' }), DWELL, 10).standing).toBe(false);
  });

  it('puts a bus at a line\'s last stop on the last dot', () => {
    expect(at(position({ stationIndex: 20 }), PATH, 60).s).toBe(20);
  });

  it('drives a loop\'s bus on past its last stop, toward station 0 (HSSC loop wrap)', () => {
    // Arrange
    const leaving = position({ stationIndex: 10 });
    const back: TrajectoryKnot[] = [
      { atMs: SEEN, s: 10 },
      { atMs: SEEN + 30_000, s: 11 },
    ];

    // Assert
    expect(at(leaving, back, 15, LOOP).s).toBeCloseTo(10.5);
    expect(at(leaving, back, 60, LOOP).s).toBe(10 + MAX_TRACKED_PROGRESS);
  });

  it('ages a bus by when the server checked it, not by when its source saw it (HSSC stop events)', () => {
    // Arrange: seen at its stop five minutes ago, checked just now
    const p = position({ status: 'atStop', positionAtMs: SEEN - 300_000 });

    // Assert
    expect(at(p, DWELL, 70)).toMatchObject({ s: 9 + PRE_DEPARTURE_CAP, dimmed: false, following: true });
  });

  it('dims a bus whose check is over two minutes old, and stops it past three', () => {
    // Arrange: a crawl, so the cap short of the next stop is never what holds it
    const crawl: TrajectoryKnot[] = [
      { atMs: SEEN, s: 9 },
      { atMs: SEEN + 1_000_000, s: 9.9 },
    ];

    // Act
    const slowed = at(running, crawl, SLOW_AFTER_MS / 1000 + 10);
    const frozen = at(running, crawl, FREEZE_AFTER_MS / 1000 + 10);
    const later = at(running, crawl, FREEZE_AFTER_MS / 1000 + 600);

    // Assert
    expect(at(running, crawl, SLOW_AFTER_MS / 1000).dimmed).toBe(false);
    expect(slowed.dimmed).toBe(true);
    expect(frozen.dimmed).toBe(true);
    expect(later.s).toBe(frozen.s);
    expect(frozen.s).toBeLessThan(9 + MAX_TRACKED_PROGRESS);
  });
});

describe('planTrajectoryMarker', () => {
  const T0 = 9_000_000;
  const ROW = STATION_ROW_HEIGHT;

  function run(targets: number[]): MarkerPlan[] {
    const plans: MarkerPlan[] = [];
    let state: MarkerPlan['state'] | undefined;
    targets.forEach((target, i) => {
      const plan = planTrajectoryMarker(state, target, T0 + i * 1000);
      plans.push(plan);
      state = plan.state;
    });
    return plans;
  }

  it('places a new marker at once, then follows driving each second', () => {
    const plans = run([300, 303, 306]);
    expect(plans.map((p) => [p.top, p.glide])).toStrictEqual([[300, false], [303, true], [306, true]]);
  });

  it('chases a bus a poll moved well ahead in a few seconds, never in one step', () => {
    const plans = run([300, 300 + ROW, 300 + ROW, 300 + ROW, 300 + ROW, 300 + ROW]);
    expect(plans[1]!.top).toBe(300 + ROW * CHASE_SHARE);
    expect(plans.slice(1).every((p, i) => p.top >= plans[i]!.top), 'never backward').toBeTruthy();
    expect(plans[5]!.top, 'caught up within five seconds').toBe(300 + ROW);
    expect(plans[1]!.top < 300 + ROW).toBeTruthy();
  });

  it('holds still while the target is behind it', () => {
    const plans = run([300, 280, 290, 305]);
    expect(plans.map((p) => p.top)).toStrictEqual([300, 300, 300, 305]);
  });

  it('starts over at once on a new trip far back up the line', () => {
    const plans = run([2000, 19]);
    expect(plans[1]!.top).toBe(19);
    expect(plans[1]!.glide).toBe(false);
  });

  it('spreads the rest of a chase over the poll when the bus loses its path mid-chase', () => {
    // Arrange
    const [, chasing] = run([300, 300 + ROW]);

    // Act
    const next = planMarker(chasing!.state, 300 + ROW, T0 + 2000, 40_000);

    // Assert
    expect(next.top - chasing!.top).toBeLessThan(LEAP_PT);
  });

  it('carries on from a plan made without a path', () => {
    const before = planMarker(undefined, 300, T0, 40_000);
    const next = planTrajectoryMarker(before.state, 310, T0 + 1000);
    expect(next.top).toBe(310);
    expect(next.glide).toBe(true);
  });
});

describe('shouldSnap — a marker is placed, not glided, when what it shows is out of date', () => {
  const RESUMED = 10_000_000;
  const after = (ms: number) => RESUMED + ms;

  it('places a marker that has never been planned', () => {
    expect(shouldSnap(undefined, { nowMs: after(1000), pollAtMs: after(500), resumedAtMs: RESUMED })).toBe(true);
  });

  it('places it on the first plan after the screen opened or the app came back', () => {
    // Arrange: last planned before the app went to the background
    const last = { atMs: RESUMED - 5000, pollAtMs: RESUMED - 8000 };

    // Act & Assert
    expect(shouldSnap(last, { nowMs: after(100), pollAtMs: RESUMED - 8000, resumedAtMs: RESUMED })).toBe(true);
  });

  it('places it again on the first poll that arrives after that, then glides', () => {
    // Arrange: planned once since the return, from the poll that was on screen before it
    const fromOldPoll = { atMs: after(100), pollAtMs: RESUMED - 8000 };
    const fromNewPoll = { atMs: after(1200), pollAtMs: after(1100) };

    // Act & Assert
    expect(shouldSnap(fromOldPoll, { nowMs: after(1200), pollAtMs: after(1100), resumedAtMs: RESUMED })).toBe(true);
    expect(shouldSnap(fromNewPoll, { nowMs: after(2200), pollAtMs: after(1100), resumedAtMs: RESUMED })).toBe(false);
    expect(shouldSnap(fromNewPoll, { nowMs: after(25_000), pollAtMs: after(24_000), resumedAtMs: RESUMED })).toBe(false);
  });

  it('places it after a gap in planning longer than the snap bound, however it came about', () => {
    // Arrange
    const last = { atMs: after(1000), pollAtMs: after(900) };

    // Act & Assert
    expect(shouldSnap(last, { nowMs: after(1000 + SNAP_AFTER_MS + 1), pollAtMs: after(900), resumedAtMs: RESUMED })).toBe(true);
    expect(shouldSnap(last, { nowMs: after(1000 + SNAP_AFTER_MS), pollAtMs: after(900), resumedAtMs: RESUMED })).toBe(false);
  });
});

describe('isAwaitingFreshPoll — after a return, the screen waits for a poll newer than it', () => {
  const RESUMED = 20_000_000;

  it('waits while the poll on screen is from before the return', () => {
    expect(isAwaitingFreshPoll({ pollAtMs: RESUMED - 60_000, resumedAtMs: RESUMED, nowMs: RESUMED + 500 })).toBe(true);
  });

  it('stops waiting once a poll from after the return lands', () => {
    expect(isAwaitingFreshPoll({ pollAtMs: RESUMED + 400, resumedAtMs: RESUMED, nowMs: RESUMED + 500 })).toBe(false);
  });

  it('gives up after the wait bound, falling back to the old poll read at the current time', () => {
    // Arrange
    const old = { pollAtMs: RESUMED - 60_000, resumedAtMs: RESUMED };

    // Act & Assert
    expect(isAwaitingFreshPoll({ ...old, nowMs: RESUMED + FRESH_POLL_WAIT_MS - 1 })).toBe(true);
    expect(isAwaitingFreshPoll({ ...old, nowMs: RESUMED + FRESH_POLL_WAIT_MS })).toBe(false);
  });

  it('never waits on a fresh mount with no data yet', () => {
    expect(isAwaitingFreshPoll({ pollAtMs: 0, resumedAtMs: RESUMED, nowMs: RESUMED + 500 })).toBe(false);
  });
});

describe('resumedAt — when the screen came back', () => {
  const FOREGROUND = 30_000_000;

  it('is the foreground event while the clock ticks without a gap', () => {
    expect(resumedAt({ foregroundAtMs: FOREGROUND, lastTickMs: FOREGROUND + 5000, nowMs: FOREGROUND + 6000 })).toBe(
      FOREGROUND,
    );
  });

  it('is the tick a clock gap ends in, before the foreground event arrives (a resumed timer fired first)', () => {
    // Arrange: last ticked 70 s ago, then the app was in the background
    const now = FOREGROUND + 100_000;

    // Act & Assert
    expect(resumedAt({ foregroundAtMs: FOREGROUND, lastTickMs: now - 70_000, nowMs: now })).toBe(now);
  });

  it('never counts a gap within the snap bound as a return', () => {
    const now = FOREGROUND + 100_000;
    expect(resumedAt({ foregroundAtMs: FOREGROUND, lastTickMs: now - SNAP_AFTER_MS, nowMs: now })).toBe(FOREGROUND);
  });
});
