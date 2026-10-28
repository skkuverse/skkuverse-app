// SEE: docs/decisions/0020-app-architecture.md (D1): the event map's calls to the /map overlays module.
import { queryOptions } from '@tanstack/react-query';
import { parseOrThrow, safeGet } from '@skkuverse/shared';
import { placeDetailsSchema } from './place-detail.schema';
import type { PlaceDetail } from './place-detail.types';

export const PLACE_DETAILS_KEY = ['eventmap', 'place', 'details'] as const;

/**
 * WHY: one request for every place, so after the first sheet a tapped pin's sheet opens with its menu in it.
 * A failure is not surfaced: a place without a detail draws from the overlay alone.
 */
export function placeDetailsQueryOptions(overlayEndpoint: string | null) {
  const endpoint = overlayEndpoint === null ? null : `${overlayEndpoint}/details`;
  return queryOptions<Record<string, PlaceDetail>>({
    queryKey: [...PLACE_DETAILS_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint as string, (envelope) =>
        parseOrThrow(placeDetailsSchema, envelope.data, 'GET /map/overlays/event/details'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: endpoint !== null,
    // WHY: the overlays' staleness, so a pin and its sheet refresh together.
    staleTime: 60_000,
  });
}
