// SEE: docs/decisions/0020-app-architecture.md (D1): the campus sheet's call to the server's /ui module.
import { queryOptions } from '@tanstack/react-query';
import { ApiEndpoints, parseOrThrow, safeGet } from '@skkuverse/shared';
import { campusSectionsSchema } from './campus-sheet.schema';
import type { CampusSectionsResponse } from './campus-sheet.types';

export const CAMPUS_SECTIONS_KEY = ['campus', 'sections'] as const;

/** WHY: the queryFn throws rather than returning the defaults, so a failure is never cached over a good feed. */
export function campusSectionsQueryOptions() {
  return queryOptions<CampusSectionsResponse>({
    queryKey: CAMPUS_SECTIONS_KEY,
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.homeCampus(),
        (envelope) => parseOrThrow(campusSectionsSchema, envelope.data, 'GET /ui/home/campus'),
      );

      if (result.ok) {
        return result.data;
      }

      if (__DEV__) {
        console.debug('[campus] API failed:', result.failure);
      }
      throw result.failure;
    },
    staleTime: 60_000,
  });
}
