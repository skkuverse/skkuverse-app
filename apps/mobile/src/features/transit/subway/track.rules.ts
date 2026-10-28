import type { SubwayDirectionKey } from '@skkuverse/shared';
import { trackPosition } from './countdown.rules';

// WHY: stations are evenly spaced as on a line map, and the far end (0) stands for the third station before and farther.
export const TRACK_TICKS = [2 / 3, 1 / 3] as const;

export const TRACK_WINDOW_MS = 6 * 60_000;

const STOPS = [1, ...TRACK_TICKS, 0] as const;
const SHORT_OF_STATION = 0.03;

// CONTRACT(skkuverse-server): skkuverse-server/docs/reference/subway-api.md
// WHY: a count of 2 or more is approaching the nearer station or standing at it, which the wire does not tell apart, so the farther stretch is used.
export function trainTrackPosition(
  train: { stopsAway: number | null; arrivalAt: number },
  now: number,
): number {
  const byTime = trackPosition(train.arrivalAt, now, TRACK_WINDOW_MS);
  const { stopsAway } = train;
  if (stopsAway == null) return byTime;
  if (stopsAway <= 0) return STOPS[0];
  const k = Math.min(stopsAway, STOPS.length - 1);
  const from = STOPS[k];
  const to = STOPS[k - 1] - SHORT_OF_STATION;
  return Math.min(Math.max(byTime, from), Math.max(from, to));
}

const TRAINS_ON_TRACK = 2;

// WHY: an unplaceable train leaves no gap for a later one, so a third train never shows as the second.
export function trainsOnTrack<T extends { onTrack: boolean }>(trains: readonly T[]): T[] {
  return trains.slice(0, TRAINS_ON_TRACK).filter((train) => train.onTrack);
}

export type TrackSide = 'left' | 'right';

// WHY: as a Korean station sign draws it, `up` points left and `down` right.
export function directionSide(direction: SubwayDirectionKey): TrackSide {
  return direction === 'up' ? 'left' : 'right';
}

// WHY: a left-heading direction is mirrored, so its trains come in from the right.
export function trackX(position: number, side: TrackSide): number {
  return side === 'left' ? 1 - position : position;
}
