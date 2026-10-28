/**
 * A last-known-good copy of a server response (ADR 0020 D7): the cache seeds
 * the query and is never the answer to a failed fetch, it stores the payload as
 * the server sent it, and every read parses it with the reader's own parser.
 * Runs the real helper and React Query; only MMKV is a double.
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedQueryOptions } from '../cached-query-options';

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => stored.get(key),
    set: (key: string, value: string) => {
      stored.set(key, value);
    },
    remove: (key: string) => stored.delete(key),
  }),
}));

const CACHE_KEY = 'test:thing:v2';
const RETIRED_KEY = 'test:thing:v1';

interface Thing {
  name: string;
  badge?: string;
}

function parseName(raw: unknown): Thing | null {
  const name = (raw as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? { name } : null;
}

/** A newer build's parser, which also reads `badge`. */
function parseNameAndBadge(raw: unknown): Thing | null {
  const thing = parseName(raw);
  const badge = (raw as { badge?: unknown }).badge;
  return thing && typeof badge === 'string' ? { ...thing, badge } : thing;
}

/** A parser that says why it rejects, as one built on parseOrThrow does. */
function throwingParse(raw: unknown): Thing {
  const thing = parseName(raw);
  if (!thing) throw new Error('name is missing');
  return thing;
}

const serving = (raw: unknown) => () => Promise.resolve(raw);
const offline = () => Promise.reject(new Error('Network Error'));

function options(fetch: () => Promise<unknown>, parse: (raw: unknown) => Thing | null = parseName) {
  return cachedQueryOptions({
    queryKey: ['test', 'thing'],
    cacheKey: CACHE_KEY,
    retiredCacheKeys: [RETIRED_KEY],
    fetch,
    parse,
    staleTime: 60_000,
  });
}

/** A fresh query over the cache as it stands, as on a relaunch. */
function query(fetch: () => Promise<unknown>, parse: (raw: unknown) => Thing | null = parseName) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const built = options(fetch, parse);
  return {
    fetch: () => client.fetchQuery(built),
    state: () => client.getQueryState(built.queryKey),
    seed: () => (typeof built.initialData === 'function' ? built.initialData() : built.initialData),
  };
}

function cache(raw: unknown): void {
  stored.set(CACHE_KEY, JSON.stringify(raw));
}

beforeEach(() => {
  stored.clear();
});

describe('cachedQueryOptions', () => {
  it('reports a failed fetch as a failure and keeps showing the cached value, stale', async () => {
    // Arrange
    cache({ name: 'cached' });
    const thing = query(offline);

    // Act
    await thing.fetch().catch(() => undefined);

    // Assert
    expect(thing.state()).toMatchObject({ status: 'error', data: { name: 'cached' }, dataUpdatedAt: 0 });
  });

  it('has no data after a failed fetch with nothing cached', async () => {
    // Arrange
    const thing = query(offline);

    // Act
    await thing.fetch().catch(() => undefined);

    // Assert
    expect(thing.state()).toMatchObject({ status: 'error', data: undefined });
  });

  it('fails on a response the parser rejects, naming the cache key, and keeps the cache', async () => {
    // Arrange
    cache({ name: 'cached' });
    const thing = query(serving({ notAThing: true }));

    // Act
    const fetching = thing.fetch();

    // Assert
    await expect(fetching).rejects.toThrow(CACHE_KEY);
    expect(JSON.parse(stored.get(CACHE_KEY) ?? 'null')).toEqual({ name: 'cached' });
  });

  it('fails on a response the parser throws on, with the parser\'s reason and the cache key, and keeps the cache', async () => {
    // Arrange
    cache({ name: 'cached' });
    const thing = query(serving({ notAThing: true }), throwingParse);

    // Act
    const fetching = thing.fetch();

    // Assert
    await expect(fetching).rejects.toThrow(CACHE_KEY);
    await expect(fetching).rejects.toThrow('name is missing');
    expect(JSON.parse(stored.get(CACHE_KEY) ?? 'null')).toEqual({ name: 'cached' });
  });

  it('seeds nothing from a cache its parser throws on', () => {
    // Arrange
    cache({ notAThing: true });

    // Act
    const seed = query(offline, throwingParse).seed();

    // Assert
    expect(seed).toBeUndefined();
  });

  it('stores a successful response as received and drops the retired keys', async () => {
    // Arrange
    stored.set(RETIRED_KEY, JSON.stringify({ name: 'parsed long ago' }));
    const raw = { name: 'fresh', fieldFromTheFuture: 'new' };
    const thing = query(serving(raw));

    // Act
    const value = await thing.fetch();

    // Assert
    expect(value).toEqual({ name: 'fresh' });
    expect(JSON.parse(stored.get(CACHE_KEY) ?? 'null')).toEqual(raw);
    expect(stored.has(RETIRED_KEY)).toBe(false);
  });

  it('stores what toCopy keeps and still answers with the whole response', async () => {
    // Arrange
    const raw = { name: 'fresh', badge: 'today only' };
    const built = cachedQueryOptions({
      queryKey: ['test', 'thing'],
      cacheKey: CACHE_KEY,
      fetch: serving(raw),
      parse: parseNameAndBadge,
      staleTime: 60_000,
      toCopy: (_raw, value) => ({ name: value.name }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Act
    const value = await client.fetchQuery(built);

    // Assert
    expect(value).toEqual(raw);
    expect(JSON.parse(stored.get(CACHE_KEY) ?? 'null')).toEqual({ name: 'fresh' });
  });

  it('parses the cache on read, so a newer parser reads a field an older build stored', () => {
    // Arrange
    cache({ name: 'cached', badge: 'new' });

    // Act
    const seed = query(offline, parseNameAndBadge).seed();

    // Assert
    expect(seed).toEqual({ name: 'cached', badge: 'new' });
  });

  it('seeds nothing from a cache its parser rejects', () => {
    // Arrange
    cache({ notAThing: true });

    // Act
    const seed = query(offline).seed();

    // Assert
    expect(seed).toBeUndefined();
  });
});
