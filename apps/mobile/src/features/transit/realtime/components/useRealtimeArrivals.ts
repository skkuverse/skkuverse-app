import { useMemo } from 'react';
import { arrivalLines, isServiceOver, lowFloorVehicleIds, type ArrivalLine } from '../../arrival.rules';
import type { LiveGroup } from '../../transit.types';

export function useRealtimeArrivals(
  live: LiveGroup | undefined,
  clockOffsetMs: number,
  hasLowFloor: boolean,
  awaitingFreshPoll: boolean,
  now: number,
) {
  const lowFloorIds = useMemo(() => lowFloorVehicleIds(live?.vehicles ?? [], hasLowFloor), [live, hasLowFloor]);
  return useMemo(() => {
    // WHY: minutes counted from a poll the buses have left behind would be wrong; none are shown
    // until a fresh poll lands (or the wait runs out).
    if (!live || awaitingFreshPoll) return { lines: new Map<number, ArrivalLine>(), serviceOver: false, lowFloorIds };
    return {
      lines: arrivalLines(live, now + clockOffsetMs),
      serviceOver: isServiceOver(live),
      lowFloorIds,
    };
  }, [live, now, clockOffsetMs, lowFloorIds, awaitingFreshPoll]);
}
