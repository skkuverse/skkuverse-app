import { useCallback, useMemo } from 'react';
import { useClock } from '@/platform/clock';
import { nextWindowEdge } from './window-edge.rules';
import type { DailyWindow } from '../../map-config.types';
import type { OpeningWindow } from '../../overlay.types';

interface HasHours {
  hours: OpeningWindow[];
}

// WHY: module-level, not a `= []` default, which would mint a new array each render, so a new
// `nextEdge` each render, which `useClock` reads as new data and restarts on.
const NO_DAILY_WINDOWS: readonly DailyWindow[] = [];

/**
 * WHY: either side of a boundary the payload is identical, so a value the derivation depends on has to change.
 * Pass stable inputs; a hidden layer arms no timer, so `useMapHost` passes the layers' windows.
 */
export function useWindowEdgeClock(
  items: readonly HasHours[],
  dailyWindows: readonly DailyWindow[] = NO_DAILY_WINDOWS,
): number {
  const hours = useMemo(() => items.flatMap((i) => i.hours), [items]);
  const nextEdge = useCallback((now: number) => nextWindowEdge(hours, dailyWindows, now), [hours, dailyWindows]);
  return useClock(nextEdge);
}
