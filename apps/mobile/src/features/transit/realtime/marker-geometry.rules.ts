import type { TrajectoryKnot, VehiclePosition } from '../transit.types';

export const STATION_ROW_HEIGHT = 66;
export const LEFT_PADDING = 70;
export const PLATE_GUTTER = 60;
export const PULSE_SIZE = 28;

export function dotCenterY(stationIndex: number): number {
  return STATION_ROW_HEIGHT * stationIndex + STATION_ROW_HEIGHT / 2;
}

export interface LineShape {
  lastStationIndex: number;
  isLoop: boolean;
}

/**
 * WHY: a loop's section after the last station leads back to station 0, so it runs on below the
 * last dot, and a completed lap is placed at `s mod stationCount`; a line holds `s` on its dots.
 */
export function markerTop(s: number, line: LineShape): number {
  const last = Math.max(0, line.lastStationIndex);
  const placed = line.isLoop ? Math.max(0, s) % (last + 1) : Math.min(Math.max(0, s), last);
  return dotCenterY(placed) - PULSE_SIZE / 2;
}

/**
 * EVIDENCE: about 14 km/h, a village bus in central Seoul between stops. Used when the source
 * gives no time to the next stop, so the marker keeps moving; `MAX_TRACKED_PROGRESS` caps it.
 */
export const ASSUMED_SPEED_MPS = 4;

/**
 * WHY: only the server moves a bus onto the next stop, so an estimate that runs ahead stops short
 * of it.
 */
export const MAX_TRACKED_PROGRESS = 0.95;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function secondsToNextStop(position: VehiclePosition, served: number): number | null {
  if (position.nextStationAtMs !== null && position.nextStationAtMs > position.positionAtMs) {
    return (position.nextStationAtMs - position.positionAtMs) / 1000;
  }
  if (position.sectionMeters === null || position.sectionMeters <= 0) return null;
  return (position.sectionMeters * (1 - served)) / ASSUMED_SPEED_MPS;
}

/**
 * WHY: never behind the served progress; with no time to the next stop the bus holds where it was
 * seen rather than moving on a guess.
 */
export function trackedProgress(position: VehiclePosition, atMs: number): number {
  if (position.status !== 'inTransit') return 0;
  const served = clamp01(position.progress ?? 0);
  const seconds = secondsToNextStop(position, served);
  if (seconds === null || seconds <= 0) return served;
  const share = clamp01((atMs - position.positionAtMs) / (seconds * 1000));
  const estimated = Math.min(served + (1 - served) * share, MAX_TRACKED_PROGRESS);
  return Math.max(served, estimated);
}

/**
 * EVIDENCE: a healthy marker re-plans every second and a poll lands every 10 to 25 s, so a longer
 * gap means the drawn place is out of date (backgrounded, not rendering) and it is placed, not glided.
 */
export const SNAP_AFTER_MS = 30_000;

/**
 * QUIRK(react-native): a resumed timer can fire before the foreground event, so the gap is read in
 * the render the clock resumes in; otherwise a marker is placed from the old poll in between.
 */
export function resumedAt({
  foregroundAtMs,
  lastTickMs,
  nowMs,
}: {
  foregroundAtMs: number;
  lastTickMs: number;
  nowMs: number;
}): number {
  return nowMs - lastTickMs > SNAP_AFTER_MS ? Math.max(foregroundAtMs, nowMs) : foregroundAtMs;
}

export interface PlanStamp {
  atMs: number;
  pollAtMs: number;
}

/**
 * WHY: only the first plan after a return and the first poll after it place a marker at once;
 * every other plan glides so movement stays smooth between polls.
 */
export function shouldSnap(
  last: PlanStamp | undefined,
  { nowMs, pollAtMs, resumedAtMs }: { nowMs: number; pollAtMs: number; resumedAtMs: number },
): boolean {
  if (!last) return true;
  if (nowMs - last.atMs > SNAP_AFTER_MS) return true;
  if (last.atMs < resumedAtMs) return true;
  return pollAtMs !== last.pollAtMs && last.pollAtMs <= resumedAtMs;
}

/**
 * WHY: the live query refetches on a return, so a healthy answer lands well inside this; past it
 * the screen reads the poll it has at the current time.
 */
export const FRESH_POLL_WAIT_MS = 3_000;

/**
 * WHY: while held, markers stay dimmed where drawn and no countdown shows, so nothing is placed or
 * counted from an answer the buses have left behind. No data means nothing to hold.
 */
export function isAwaitingFreshPoll({
  pollAtMs,
  resumedAtMs,
  nowMs,
}: {
  pollAtMs: number;
  resumedAtMs: number;
  nowMs: number;
}): boolean {
  if (pollAtMs === 0 || pollAtMs > resumedAtMs) return false;
  return nowMs - resumedAtMs < FRESH_POLL_WAIT_MS;
}

/** WHY: a drop this far up the line is a new trip (a loop restarting at the top), not a correction. */
export const RESET_DROP_PT = STATION_ROW_HEIGHT * 2;

/**
 * EVIDENCE: the server sees TOPIS every ~40 s, so a poll often moves a bus a whole stop; a quarter
 * of a segment is more than a bus covers in a second.
 */
export const LEAP_PT = STATION_ROW_HEIGHT / 4;

export interface MarkerPlanState {
  displayed: number;
  target: number;
  debt: number;
  debtAtMs: number;
}

export interface MarkerPlan {
  top: number;
  glide: boolean;
  state: MarkerPlanState;
}

function remainingDebt(debt: number, debtAtMs: number, nowMs: number, spreadMs: number): number {
  return debt * Math.max(0, 1 - (nowMs - debtAtMs) / spreadMs);
}

/**
 * WHY: a marker never jumps stop to stop; it always draws the state in between, predicted if need be,
 * so a leap is spread over the time to the next poll. A step back holds still, unless the bus is
 * `standing` (a server that took back an HSSC departure), when it glides back.
 */
export function planMarker(
  state: MarkerPlanState | undefined,
  targetTop: number,
  nowMs: number,
  spreadMs: number,
  standing = false,
): MarkerPlan {
  if (!state || state.displayed - targetTop >= RESET_DROP_PT) {
    return {
      top: targetTop,
      glide: false,
      state: { displayed: targetTop, target: targetTop, debt: 0, debtAtMs: nowMs },
    };
  }
  if (standing && targetTop < state.displayed) {
    return {
      top: targetTop,
      glide: true,
      state: { displayed: targetTop, target: targetTop, debt: 0, debtAtMs: nowMs },
    };
  }
  let { debt, debtAtMs } = state;
  if (targetTop - state.target > LEAP_PT) {
    const current = Math.max(
      state.displayed,
      state.target - remainingDebt(debt, debtAtMs, nowMs, spreadMs),
    );
    debt = Math.max(0, targetTop - current);
    debtAtMs = nowMs;
  }
  const top = Math.max(state.displayed, targetTop - remainingDebt(debt, debtAtMs, nowMs, spreadMs));
  return { top, glide: true, state: { displayed: top, target: targetTop, debt, debtAtMs } };
}

/** WHY: the marker glides one second to each position, so it reads where the bus will be when the glide ends. */
export const LOOKAHEAD_MS = 1000;

/**
 * EVIDENCE: a healthy answer reaches the screen up to ~120 s old (skkuverse-server's measurement),
 * so dimming and half speed start no sooner.
 */
export const SLOW_AFTER_MS = 120_000;

export const FREEZE_AFTER_MS = 180_000;

/** WHY: a stop's dwell can run long until a poll says the bus is running, so the marker only edges out. */
export const PRE_DEPARTURE_CAP = 0.25;

export function trajectoryS(knots: readonly TrajectoryKnot[], atMs: number): number {
  const first = knots[0]!;
  if (atMs <= first.atMs) return first.s;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1]!;
    const b = knots[i]!;
    if (atMs < b.atMs) return a.s + ((b.s - a.s) * (atMs - a.atMs)) / (b.atMs - a.atMs);
  }
  return knots[knots.length - 1]!.s;
}

export function agedOffsetMs(ageMs: number): number {
  if (ageMs <= SLOW_AFTER_MS) return ageMs;
  return SLOW_AFTER_MS + (Math.min(ageMs, FREEZE_AFTER_MS) - SLOW_AFTER_MS) / 2;
}

export interface MarkerTarget {
  s: number;
  dimmed: boolean;
  following: boolean;
  standing: boolean;
}

/**
 * WHY: a loop's last stop is no terminus (the bus drives on toward station 0); a pathless bus is
 * placed by its stop or progress, and only a poll moves it onto the next stop.
 */
export function markerTarget(
  position: VehiclePosition,
  trajectory: readonly TrajectoryKnot[] | null,
  line: LineShape,
  serverNowMs: number,
): MarkerTarget {
  // WHY: aged by `checkedAt`, never `positionAt`; a stop-event source (HSSC) repeats its last event
  // until the next stop, so a minutes-old `positionAt` is normal.
  const ageMs = serverNowMs + LOOKAHEAD_MS - position.checkedAtMs;
  const atMs = position.checkedAtMs + agedOffsetMs(ageMs);
  const dimmed = ageMs > SLOW_AFTER_MS;
  const last = Math.max(0, line.lastStationIndex);
  const index = Math.min(position.stationIndex, last);
  if ((!line.isLoop && index >= last) || position.status === 'waitingToDepart') {
    return { s: index, dimmed, following: false, standing: true };
  }
  if (trajectory) {
    const reach = position.status === 'atStop' ? PRE_DEPARTURE_CAP : MAX_TRACKED_PROGRESS;
    const s = Math.min(Math.max(trajectoryS(trajectory, atMs), index), index + reach);
    return { s, dimmed, following: true, standing: false };
  }
  if (position.status === 'atStop') return { s: index, dimmed, following: false, standing: true };
  return { s: index + trackedProgress(position, atMs), dimmed, following: false, standing: false };
}

/** WHY: about three seconds to catch a bus a poll moved ahead, fast enough not to lag, slow enough to read as driving. */
export const CHASE_SHARE = 0.4;

/**
 * WHY: shares `planMarker`'s state so a bus that gains or loses its path between polls carries on
 * from where it is drawn; never backward, never a jump.
 */
export function planTrajectoryMarker(
  state: MarkerPlanState | undefined,
  targetTop: number,
  nowMs: number,
): MarkerPlan {
  if (!state || state.displayed - targetTop >= RESET_DROP_PT) {
    return {
      top: targetTop,
      glide: false,
      state: { displayed: targetTop, target: targetTop, debt: 0, debtAtMs: nowMs },
    };
  }
  const gap = targetTop - state.displayed;
  const top =
    gap <= 0
      ? state.displayed
      : gap <= LEAP_PT
        ? targetTop
        : state.displayed + Math.max(LEAP_PT, gap * CHASE_SHARE);
  // WHY: the gap still to chase is debt, so a bus that loses its path mid-chase is spread by `planMarker`.
  return {
    top,
    glide: true,
    state: { displayed: top, target: targetTop, debt: Math.max(0, targetTop - top), debtAtMs: nowMs },
  };
}
