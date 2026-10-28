// QUIRK(ios): a press must reach the server within the response's cache lifetime, so `useSmartSchedule` makes
// every refetch conditional to keep the URL cache from answering it.
import { useCallback } from 'react';
import { refreshIntervals } from './refresh-sources.rules';
import { useSmartSchedule } from './useSmartSchedule';
import type { BusService } from '../transit.types';

export function useScheduleRefresh(service: BusService | undefined) {
  const intervals = refreshIntervals(service?.refresh);
  const scheduleQuery = useSmartSchedule(service?.endpoint, {
    refetchIntervalMs: intervals.smartSchedule,
  });

  const { refetch: refetchSchedule } = scheduleQuery;
  const canRefresh = intervals.smartSchedule !== false;
  const refreshAll = useCallback(() => {
    void refetchSchedule();
  }, [refetchSchedule]);

  return { scheduleQuery, refresh: canRefresh ? refreshAll : undefined };
}
