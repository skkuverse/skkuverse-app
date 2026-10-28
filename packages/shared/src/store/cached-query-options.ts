// SEE: docs/decisions/0020-app-architecture.md (D7)
import { queryOptions, type QueryKey } from '@tanstack/react-query';
import { clearCache, readCache, writeCache } from './mmkv-cache';

export interface CachedQueryOptionsInputs<T> {
  queryKey: QueryKey;
  /** WHY: a change to the stored format changes this key. */
  cacheKey: string;
  /** WHY: throws on failure; a returned fallback would be cached as a success for the whole staleTime. */
  fetch: () => Promise<unknown>;
  /** WHY: a thrown reason, as `parseOrThrow` gives, is kept in the query's error. */
  parse: (raw: unknown) => T | null;
  /**
   * WHY: at most the server's `max-age`: the HTTP and edge caches answer repeats for free, and a longer
   * one holds data the server has already corrected.
   */
  staleTime: number;
  retiredCacheKeys?: readonly string[];
  /**
   * WHY: for data that must not outlive the response that served it; kept in the server's shape so
   * `parse` reads it back.
   */
  toCopy?: (raw: unknown, value: T) => unknown;
}

function parseResponse<T>(parse: CachedQueryOptionsInputs<T>['parse'], raw: unknown, cacheKey: string): T {
  const unparsable = `${cacheKey}: the response could not be parsed`;
  let value: T | null;
  try {
    value = parse(raw);
  } catch (error) {
    throw new Error(`${unparsable}. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (value === null) throw new Error(unparsable);
  return value;
}

export function cachedQueryOptions<T>(inputs: CachedQueryOptionsInputs<T>) {
  const { queryKey, cacheKey, parse, staleTime, retiredCacheKeys = [], toCopy } = inputs;
  return queryOptions({
    queryKey,
    queryFn: async (): Promise<T> => {
      const raw = await inputs.fetch();
      const value = parseResponse(parse, raw, cacheKey);
      writeCache(cacheKey, toCopy ? toCopy(raw, value) : raw);
      for (const key of retiredCacheKeys) clearCache(key);
      return value;
    },
    initialData: () => readCache(cacheKey, parse) ?? undefined,
    // WHY: the copy renders at once but counts as stale, so the query fetches
    // on mount instead of trusting it for the whole stale time.
    initialDataUpdatedAt: 0,
    staleTime,
  });
}
