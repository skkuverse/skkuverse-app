/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §3. WHY: no `status` on the
 * wire, so an empty `hours` means always open and nothing else; instants, so a wrong timezone still derives,
 * and the map stays right on a dead network.
 */

import type { OpeningWindow } from './overlay.types';
import { toEpochMs } from '@skkuverse/shared';

// WHY: the ISO-to-epoch parse is shared with the KST formatters in time/;
// re-exported here so the map's importers and its suite stay as they are.
export { toEpochMs } from '@skkuverse/shared';

/** WHY: half-open `[startAt, endAt)`, matching the server; a `null` end is unannounced and bounds nothing. */
function isWindowOpen(w: OpeningWindow, now: number): boolean {
  const start = toEpochMs(w.startAt);
  const end = toEpochMs(w.endAt);
  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;
  return true;
}

/** WHY: empty means always open, never unknown or closed. */
export function isOpenNow(hours: readonly OpeningWindow[], now: number): boolean {
  if (hours.length === 0) return true;
  return hours.some((w) => isWindowOpen(w, now));
}

export function nextOpeningAfter(
  hours: readonly OpeningWindow[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const w of hours) {
    const start = toEpochMs(w.startAt);
    if (start === null || start <= now) continue;
    if (earliest === null || start < earliest) earliest = start;
  }
  return earliest;
}

/** WHY: computed locally, since offline is exactly when a server hint's request failed. */
export function nextWindowBoundaryAfter(
  hours: readonly OpeningWindow[],
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const w of hours) {
    for (const iso of [w.startAt, w.endAt]) {
      const t = toEpochMs(iso);
      if (t === null || t <= now) continue;
      if (earliest === null || t < earliest) earliest = t;
    }
  }
  return earliest;
}

/**
 * WHY: a run, not a window: touching windows are one stretch of being open, so a visitor at 13:00 is not told
 * a booth closes at 14:00 when its next window starts then.
 */
export function currentOpenRun(
  hours: readonly OpeningWindow[],
  now: number,
): { until: number | null } | null {
  const active = hours.find((w) => toEpochMs(w.startAt) !== null && isWindowOpen(w, now));
  if (!active) return null;
  let until = toEpochMs(active.endAt);
  // WHY: bounded by the window count, so a malformed chain cannot spin.
  for (let i = 0; until !== null && i < hours.length; i++) {
    const end = until;
    const next = hours.find((w) => toEpochMs(w.startAt) === end);
    if (!next) break;
    until = toEpochMs(next.endAt);
  }
  return { until };
}

/**
 * QUIRK(javascript): `setTimeout` stores its delay as a signed 32-bit int, so past ~24.8 days it fires at once
 * and a far boundary would become a re-render loop.
 */
export const MAX_TIMEOUT_MS = 2_147_483_647;
