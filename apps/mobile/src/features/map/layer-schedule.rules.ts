/**
 * WHY: the KST minute comes from the epoch, never `Date.getHours()`, so a phone in the wrong zone still flips
 * at 18:00 KST (ADR 0007). The fixed +09:00 is exact, since Korea has had no DST since 1988; a campus
 * outside Korea would need the layer set's `timezone`.
 */

import { MS_PER_DAY, MS_PER_MINUTE, msIntoKstDay, toMinutesOfDay } from '@skkuverse/shared';
import type { DailyWindow } from './map-config.types';

// WHY: the KST calendar lives in time/kst.rules.ts, which the timetable shares;
// re-exported here so the map's importers and its suite stay as they are.
export { KST_OFFSET_MS, kstMinutesOfDay, toMinutesOfDay } from '@skkuverse/shared';

/**
 * WHY: half-open `[start, end)`, matching the marker side; `start > end` wraps past midnight. An unparseable
 * bound reads closed, which cannot turn an unreadable rule into a layer drawn all day.
 */
export function isDailyWindowOpen(w: DailyWindow, minutes: number): boolean {
  const start = toMinutesOfDay(w.start);
  const end = toMinutesOfDay(w.end);
  if (start === null || end === null) return false;
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

/** WHY: never at or before `now`: a zero delay fires, re-arms at the same boundary and spins. */
export function nextDailyBoundaryAfter(
  windows: readonly DailyWindow[],
  now: number,
): number | null {
  const midnight = now - msIntoKstDay(now);
  let best: number | null = null;
  for (const w of windows) {
    for (const bound of [w.start, w.end]) {
      const minutes = toMinutesOfDay(bound);
      if (minutes === null) continue;
      let at = midnight + minutes * MS_PER_MINUTE;
      if (at <= now) at += MS_PER_DAY;
      if (best === null || at < best) best = at;
    }
  }
  return best;
}
