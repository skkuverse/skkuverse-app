// SEE: docs/decisions/0020-app-architecture.md (D1): one client for the server's /building module.
import { queryOptions } from '@tanstack/react-query';
import {
  ApiEndpoints,
  parseOrThrow,
  safeGet,
} from '@skkuverse/shared';
import { buildingDetailSchema, buildingSearchSchema } from './building.schema';
import type { BuildingDetail, BuildingSearchResult } from './building.types';

export const BUILDING_DETAIL_KEY = ['building', 'detail'] as const;
export const BUILDING_SEARCH_KEY = ['building', 'search'] as const;

export function buildingDetailQueryOptions(skkuId: number | null) {
  return queryOptions<BuildingDetail>({
    queryKey: [...BUILDING_DETAIL_KEY, skkuId],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.buildingDetail(skkuId!),
        (envelope) => parseOrThrow(buildingDetailSchema, envelope.data, 'GET /building/:id'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: skkuId != null,
    staleTime: 5 * 60_000,
  });
}

export function buildingSearchQueryOptions(query: string, campus?: string) {
  return queryOptions<BuildingSearchResult>({
    queryKey: [...BUILDING_SEARCH_KEY, query, campus],
    queryFn: async () => {
      const params: Record<string, string> = { q: query };
      if (campus) params.campus = campus;

      const result = await safeGet(
        ApiEndpoints.buildingSearch(),
        (envelope) => parseOrThrow(buildingSearchSchema, envelope, 'GET /building/search'),
        { params },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}
