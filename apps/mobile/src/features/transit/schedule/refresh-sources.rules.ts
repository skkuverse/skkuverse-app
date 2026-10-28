import type { BusService } from '../transit.types';

export type ServiceRefresh = NonNullable<BusService['refresh']>;
export type RefreshTarget = ServiceRefresh['targets'][number];

export type RefreshSource = 'smartSchedule';

export const REFRESH_SOURCE: Record<RefreshTarget, RefreshSource> = {
  traffic: 'smartSchedule',
  crowding: 'smartSchedule',
};

export function refreshIntervals(
  refresh: ServiceRefresh | undefined,
): Record<RefreshSource, number | false> {
  const needed = new Set(refresh?.targets.map((target) => REFRESH_SOURCE[target]));
  const intervalMs = refresh ? refresh.intervalSec * 1000 : false;
  return {
    smartSchedule: needed.has('smartSchedule') ? intervalMs : false,
  };
}
