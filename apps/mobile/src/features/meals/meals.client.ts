import { queryOptions } from '@tanstack/react-query';
import { ApiEndpoints, parseOrThrow, safeGet, type Campus } from '@skkuverse/shared';
import { mealsDailySchema } from './meals.schema';
import type { MealsDaily } from './meals.types';

// CONTRACT(skkuverse-server): skkuverse-server/src/meals/menus/ sends GET /meals with `Cache-Control: public, max-age=300`.
const DAILY_STALE_TIME = 5 * 60 * 1000;

export async function fetchMealsDaily(campus: Campus, date: string): Promise<MealsDaily> {
  const result = await safeGet(ApiEndpoints.meals(campus, date), (envelope) => envelope.data);
  if (!result.ok) throw new Error('Meals request failed', { cause: result.failure });
  return parseOrThrow(mealsDailySchema, result.data, 'GET /meals');
}

// WHY: no last-known-good copy. A menu is per date, and yesterday's copy answers nothing today.
export function mealsDailyQueryOptions(campus: Campus, date: string) {
  return queryOptions({
    queryKey: ['meals', 'daily', campus, date],
    queryFn: () => fetchMealsDaily(campus, date),
    staleTime: DAILY_STALE_TIME,
  });
}
