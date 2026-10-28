// SEE: docs/decisions/0020-app-architecture.md (D1): one client for the server's /journey module.
import { queryOptions } from '@tanstack/react-query';
import { ApiEndpoints, parseOrThrow, safeGet } from '@skkuverse/shared';
import { ROUTES_STALE_MS } from './campus-routes.constants';
import { campusRoutesMetaSchema, campusRoutesSchema } from './campus-routes.schema';
import type { CampusRoutesAnswer } from './campus-routes.types';

export const CAMPUS_ROUTES_KEY = ['journey', 'routes'] as const;

// WHY: no copy on disk, since a plan is only true for the minute it was made; a failed refetch keeps the last answer in memory.
export function campusRoutesQueryOptions() {
  return queryOptions<CampusRoutesAnswer>({
    queryKey: CAMPUS_ROUTES_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.journeyRoutes(), (envelope) => ({
        ...parseOrThrow(campusRoutesSchema, envelope.data, 'GET /journey/routes'),
        ...campusRoutesMetaSchema.parse(envelope.meta),
      }));
      if (!result.ok) throw result.failure;
      return { ...result.data, receivedAtMs: Date.now() };
    },
    staleTime: ROUTES_STALE_MS,
  });
}
