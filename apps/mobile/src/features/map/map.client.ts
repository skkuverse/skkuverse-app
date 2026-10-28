// SEE: docs/decisions/0020-app-architecture.md (D1): one client for the server's /map module.
import { queryOptions } from '@tanstack/react-query';
import { ApiEndpoints, cachedQueryOptions, parseOrThrow, safeGet } from '@skkuverse/shared';
import { mapConfigSchema } from './map-config.schema';
import { mapOverlaysSchema } from './overlay.schema';
import type { MapConfig } from './map-config.types';
import type { MapOverlay } from './overlay.types';

export const MAP_CONFIG_KEY = ['map', 'config'] as const;

/**
 * WHY: a key prefix, so layers sharing an endpoint share one entry and one fetch, and invalidating the prefix
 * reaches them all. Exported, since a silently wrong query key invalidates nothing.
 */
export const MAP_LAYER_OVERLAYS_KEY = ['map', 'layer', 'overlays'] as const;

async function fetchMapConfig(): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.mapConfig(), (envelope) => envelope.data);
  if (result.ok) return result.data;
  if (__DEV__) {
    console.debug('[map] config API failed:', result.failure);
  }
  throw result.failure;
}

/**
 * WHY: the queryFn throws rather than returning the defaults, which carry no festival layers and, cached as a
 * success, would hide every booth for the staleTime; this route is not edge-cached. The whole response is
 * the last-known-good copy, so a chip's `layerIds` cannot disagree with its layers.
 */
export function mapConfigQueryOptions() {
  return queryOptions({
    ...cachedQueryOptions<MapConfig>({
      queryKey: MAP_CONFIG_KEY,
      cacheKey: 'map:config:v1',
      fetch: fetchMapConfig,
      parse: (raw) => parseOrThrow(mapConfigSchema, raw, 'GET /map/config'),
      // CONTRACT(skkuverse-server): skkuverse-server/src/map/config/map-config.controller.ts sends no Cache-Control,
      // so there is no max-age to stay under.
      staleTime: 5 * 60_000,
    }),
    gcTime: 30 * 60_000,
  });
}

/**
 * WHY: one query per data source, not per layer: each collection hands back pins, zones and routes together
 * for the caller to filter by `layerId`.
 */
export function layerOverlaysQueryOptions(endpoint: string, enabled: boolean) {
  return queryOptions<MapOverlay[]>({
    queryKey: [...MAP_LAYER_OVERLAYS_KEY, endpoint],
    queryFn: async () => {
      const result = await safeGet(endpoint, (envelope) =>
        parseOrThrow(mapOverlaysSchema, envelope.data, 'GET /map/overlays'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled,
    // WHY: no longer than the server's Cache-Control, a minute on the festival route so an ops correction is live
    // before anyone walks there; refetching sooner costs the origin nothing.
    staleTime: 60_000,
  });
}
