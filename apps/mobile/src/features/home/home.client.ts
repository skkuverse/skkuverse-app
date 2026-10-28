// WHY: kept though this build draws mockHomeLayout: the mini-apps tab's endpoint reuses this fetch, cache and
// fallback at its own path and cache key.
import { ApiEndpoints, cachedQueryOptions, parseOrThrow, safeGet } from '@skkuverse/shared';
import { homeLayoutSchema } from './home.schema';

// CONTRACT(skkuverse-server): skkuverse-server/src/ui/ui.constants.ts sends GET /ui/home with `Cache-Control: private, max-age=300`.
const LAYOUT_STALE_TIME = 5 * 60 * 1000;

export async function fetchHomeLayout(): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.homeLayout(), (envelope) => envelope.data);
  if (!result.ok) throw new Error('Home layout request failed', { cause: result.failure });
  return result.data;
}

export function homeLayoutQueryOptions() {
  return cachedQueryOptions({
    queryKey: ['home', 'layout'],
    cacheKey: 'home:layout:v2',
    // WHY: v1 held parsed layouts, which lose their link tiles when parsed again.
    retiredCacheKeys: ['home:layout:v1'],
    fetch: fetchHomeLayout,
    parse: (raw) => parseOrThrow(homeLayoutSchema, raw, 'GET /ui/home'),
    staleTime: LAYOUT_STALE_TIME,
  });
}
