// SEE: docs/decisions/0020-app-architecture.md (D7)
import { queryOptions } from '@tanstack/react-query';
import { ApiEndpoints, cachedQueryOptions, parseOrThrow, safeGet } from '@skkuverse/shared';
import { miniAppDetailSchema, miniAppFeedSchema, miniAppIndexSchema } from './web.schema';
import type { MiniAppIndexEntry } from './web.types';

// CONTRACT(skkuverse-server): skkuverse-server/src/miniapps/catalog/miniapps-catalog.constants.ts sends
// both registry routes with `Cache-Control: public, max-age=300`.
const REGISTRY_STALE_TIME = 5 * 60 * 1000;

// CONTRACT(skkuverse-server): skkuverse-server/src/miniapps/catalog/miniapps-catalog.constants.ts sends
// the feed with `private, max-age=3`; an older copy would miss a fresh push.
const FEED_STALE_TIME = 3_000;

export async function fetchMiniAppIndex(): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.miniApps(), (envelope) => envelope.data);
  if (!result.ok) throw new Error('Mini-app index request failed', { cause: result.failure });
  return result.data;
}

export async function fetchMiniAppDetail(miniAppId: string): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.miniAppDetail(miniAppId), (envelope) => envelope.data);
  if (!result.ok) throw new Error(`Mini-app ${miniAppId} request failed`, { cause: result.failure });
  return result.data;
}

export async function fetchMiniAppFeed(miniAppId: string): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.miniAppFeed(miniAppId), (envelope) => envelope.data);
  if (!result.ok) throw new Error(`Mini-app ${miniAppId} feed request failed`, { cause: result.failure });
  return result.data;
}

/** WHY: an index with no entries is unusable, so an empty registry fails and an empty copy seeds nothing. */
function parseIndexEntries(raw: unknown): MiniAppIndexEntry[] | null {
  const { miniApps } = parseOrThrow(miniAppIndexSchema, raw, 'GET /miniapps');
  return miniApps.length > 0 ? miniApps : null;
}

export function miniAppIndexQueryOptions() {
  return cachedQueryOptions({
    queryKey: ['miniapp', 'index'],
    cacheKey: 'miniapp:index:v3',
    // WHY: v1 and v2 held parsed indexes, which an older parser had already shaped.
    retiredCacheKeys: ['miniapp:index:v2', 'miniapp:index:v1'],
    fetch: fetchMiniAppIndex,
    parse: parseIndexEntries,
    staleTime: REGISTRY_STALE_TIME,
  });
}

export function miniAppDetailQueryOptions(miniAppId: string) {
  return cachedQueryOptions({
    queryKey: ['miniapp', 'detail', miniAppId],
    cacheKey: `miniapp:detail:v3:${miniAppId}`,
    // WHY: v1 and v2 held parsed details, so a shell an older parser defaulted stuck.
    retiredCacheKeys: [`miniapp:detail:v2:${miniAppId}`, `miniapp:detail:v1:${miniAppId}`],
    fetch: () => fetchMiniAppDetail(miniAppId),
    parse: (raw) => parseOrThrow(miniAppDetailSchema, raw, `GET /miniapps/${miniAppId}`),
    staleTime: REGISTRY_STALE_TIME,
  });
}

/** WHY: never cached; a feed read seconds after a push is exactly where a stale copy misleads. */
export function miniAppFeedQueryOptions(miniAppId: string) {
  return queryOptions({
    queryKey: ['miniapp', 'feed', miniAppId],
    queryFn: async () =>
      parseOrThrow(miniAppFeedSchema, await fetchMiniAppFeed(miniAppId), `GET /miniapps/${miniAppId}/notifications`),
    staleTime: FEED_STALE_TIME,
  });
}
