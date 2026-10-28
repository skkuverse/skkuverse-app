import { nextDailyBoundaryAfter } from '../../layer-schedule.rules';
import { nextWindowBoundaryAfter } from '../../opening-hours.rules';
import type { DailyWindow } from '../../map-config.types';
import type { OpeningWindow } from '../../overlay.types';

function earliest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

export function nextWindowEdge(
  hours: readonly OpeningWindow[],
  dailyWindows: readonly DailyWindow[],
  now: number,
): number | null {
  return earliest(nextWindowBoundaryAfter(hours, now), nextDailyBoundaryAfter(dailyWindows, now));
}
