import type { useT } from '@skkuverse/shared';
import type { LiveArrival, LiveGroup, LiveVehicle, RealtimeStation } from './transit.types';
/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/bus-live-api.md
 * The server sends instants, never minutes; the status wins over the instants.
 */

export type ArrivalText =
  | { kind: 'minutes'; minutes: number; stopsAway: number | null }
  | { kind: 'arriving' | 'waiting' | 'ended' | 'noInfo' | 'passThrough' }
  | { kind: 'message'; text: string };

export interface ArrivalLine {
  text: ArrivalText;
  isLastRun: boolean;
}

const NO_VEHICLES: ReadonlySet<string> = new Set();

/**
 * WHY: a null is unknown, never "not low-floor", so it marks nothing; the flag is the bus's, never a stop line's.
 */
export function lowFloorVehicleIds(vehicles: readonly LiveVehicle[], hasLowFloor: boolean): ReadonlySet<string> {
  if (!hasLowFloor) return NO_VEHICLES;
  return new Set(vehicles.filter((v) => v.isLowFloor === true).map((v) => v.id));
}

export const SOON_MS = 60_000;

export const OVERDUE_MS = 120_000;

function countdown(atMs: number, nowMs: number): number | 'soon' | 'gone' {
  const remaining = atMs - nowMs;
  if (remaining < -OVERDUE_MS) return 'gone';
  if (remaining <= SOON_MS) return 'soon';
  return Math.max(1, Math.round(remaining / 60_000));
}

function sourceText(arrival: LiveArrival): ArrivalText | null {
  return arrival.providerText ? { kind: 'message', text: arrival.providerText } : null;
}

function toArrivalText(arrival: LiveArrival, nowMs: number): ArrivalText | null {
  switch (arrival.status) {
    case 'arriving': {
      const at = arrival.expectedArrivalAtMs;
      return at !== null && countdown(at, nowMs) === 'gone' ? null : { kind: 'arriving' };
    }
    case 'enRoute':
    case 'scheduled': {
      if (arrival.expectedArrivalAtMs === null) return sourceText(arrival);
      const left = countdown(arrival.expectedArrivalAtMs, nowMs);
      if (left === 'gone') return null;
      if (left === 'soon') return { kind: 'arriving' };
      const stopsAway = arrival.stopsAway !== null && arrival.stopsAway > 0 ? arrival.stopsAway : null;
      return { kind: 'minutes', minutes: left, stopsAway };
    }
    case 'waitingToDepart':
      return { kind: 'waiting' };
    case 'unknown':
      return sourceText(arrival);
  }
}

// WHY: a bus laying over at this stop (`stopsAway` 0) is the bus a rider boards.
function isWaitingElsewhere(arrival: LiveArrival): boolean {
  return arrival.status === 'waitingToDepart' && arrival.stopsAway !== 0;
}

/**
 * QUIRK(topis): TOPIS can list a bus waiting at the garage first and the one pulling in second, so the one pulling in wins.
 */
function shownLine(arrivals: readonly LiveArrival[], nowMs: number): ArrivalLine | undefined {
  const lines = arrivals.flatMap((arrival) => {
    const text = toArrivalText(arrival, nowMs);
    return text ? [{ arrival, line: { text, isLastRun: arrival.isLastRun } }] : [];
  });
  return (lines.find(({ arrival }) => !isWaitingElsewhere(arrival)) ?? lines[0])?.line;
}

export function isServiceOver(live: Pick<LiveGroup, 'operation'>): boolean {
  return live.operation === 'ended';
}

// WHY: empty once the service is over, so the screen says so once instead of on every stop.
export function arrivalLines(
  live: Pick<LiveGroup, 'operation' | 'stations'>,
  nowMs: number,
): Map<number, ArrivalLine> {
  const lines = new Map<number, ArrivalLine>();
  if (isServiceOver(live)) return lines;
  for (const station of live.stations) {
    const line =
      station.operation === 'ended'
        ? { text: { kind: 'ended' as const }, isLastRun: false }
        : station.operation === 'noData'
          ? { text: { kind: 'noInfo' as const }, isLastRun: false }
          : shownLine(station.arrivals, nowMs);
    if (line) lines.set(station.stationIndex, line);
  }
  return lines;
}

// WHY: a pass-through station never shows an arrival.
export function stationLine(
  station: Pick<RealtimeStation, 'isPassThrough'>,
  line: ArrivalLine | undefined,
): ArrivalLine | undefined {
  return station.isPassThrough ? { text: { kind: 'passThrough' }, isLastRun: false } : line;
}

type Translate = ReturnType<typeof useT>;

// WHY: one template per locale holds the separator and the word order.
export function formatArrivalText(text: ArrivalText, { t, tpl }: Translate): string {
  switch (text.kind) {
    case 'minutes':
      if (text.stopsAway === null) return tpl('realtime.arrival.minutes', text.minutes);
      return text.stopsAway === 1
        ? tpl('realtime.arrival.minutesOneStop', text.minutes)
        : tpl('realtime.arrival.minutesStops', text.minutes, text.stopsAway);
    case 'arriving':
      return t('realtime.arrival.arriving');
    case 'waiting':
      return t('realtime.arrival.waiting');
    case 'ended':
      return t('realtime.arrival.ended');
    case 'noInfo':
      return t('realtime.arrival.noInfo');
    case 'passThrough':
      return t('realtime.arrival.passThrough');
    case 'message':
      return text.text;
  }
}
