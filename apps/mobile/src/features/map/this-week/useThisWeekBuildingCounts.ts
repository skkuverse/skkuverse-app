import type { Campus } from '@skkuverse/shared';
import { THIS_WEEK_BUILDING_COUNTS } from './this-week.constants';
import { useThisWeekStore } from './this-week.store';

export function useThisWeekBuildingCounts(campus: Campus): ReadonlyMap<string, number> {
  const weekId = useThisWeekStore((s) => s.weekId);
  return THIS_WEEK_BUILDING_COUNTS[weekId][campus];
}
