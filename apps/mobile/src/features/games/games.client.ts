// SEE: docs/decisions/0020-app-architecture.md (D7)
import { ApiEndpoints, cachedQueryOptions, parseOrThrow, safeGet } from '@skkuverse/shared';
import { gameEntrySchema, gameIndexSchema } from './games.schema';

// CONTRACT(skkuverse-server): skkuverse-server/src/games/games.constants.ts sends both registry routes with
// `Cache-Control: public, max-age=300` (GAMES_CACHE_CONTROL); a 503 or 404 carries none.
const REGISTRY_STALE_TIME = 5 * 60 * 1000;

export async function fetchGameIndex(): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.games(), (envelope) => envelope.data);
  if (!result.ok) throw new Error('Game index request failed', { cause: result.failure });
  return result.data;
}

export async function fetchGameDetail(gameId: string): Promise<unknown> {
  const result = await safeGet(ApiEndpoints.gameDetail(gameId), (envelope) => envelope.data);
  if (!result.ok) throw new Error(`Game ${gameId} request failed`, { cause: result.failure });
  return result.data;
}

/**
 * WHY: a failed fetch keeps the last good copy; with none the query has no data, which reads as the registry
 * unreachable.
 */
export function gameIndexQueryOptions() {
  return cachedQueryOptions({
    queryKey: ['games', 'index'],
    cacheKey: 'games:index:v1',
    fetch: fetchGameIndex,
    parse: (raw) => parseOrThrow(gameIndexSchema, raw, 'GET /games').games,
    staleTime: REGISTRY_STALE_TIME,
  });
}

/** WHY: a 404 keeps a cached copy like any failure; whether a game opens is the index's decision, never this one's. */
export function gameDetailQueryOptions(gameId: string) {
  return cachedQueryOptions({
    queryKey: ['games', 'detail', gameId],
    cacheKey: `games:detail:v1:${gameId}`,
    fetch: () => fetchGameDetail(gameId),
    parse: (raw) => parseOrThrow(gameEntrySchema, raw, `GET /games/${gameId}`),
    staleTime: REGISTRY_STALE_TIME,
  });
}
