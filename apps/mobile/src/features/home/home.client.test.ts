/**
 * The home layout query over the real client, schema and cache (spec
 * home/home-layout): a relaunch paints exactly what the fetch produced, link
 * tiles included. The cache's generic behavior is cachedQueryOptions' own
 * suite; only the HTTP client and MMKV are doubles here.
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMMKV, resetMMKV } from '../../../test-support/react-native-mmkv';
import { fetchHomeLayout, homeLayoutQueryOptions } from './home.client';
import { homeLayoutSchema } from './home.schema';
import ko from './__fixtures__/home-layout.production-ko.json';

const http = vi.hoisted(() => ({ body: undefined as unknown, down: false }));

vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async () => {
      if (http.down) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
      return { data: http.body };
    },
  }),
}));

function serve(data: unknown): void {
  http.down = false;
  http.body = { meta: { lang: 'ko' }, data };
}

function goOffline(): void {
  http.down = true;
}

/** One run of the query, on a fresh client. */
function fetchLayoutQuery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return client.fetchQuery(homeLayoutQueryOptions());
}

/** A relaunch: the query's seed, read from the cache alone. */
function warmStart() {
  const { initialData } = homeLayoutQueryOptions();
  return typeof initialData === 'function' ? initialData() : initialData;
}

beforeEach(() => {
  resetMMKV();
});

describe('the home layout query', () => {
  it('paints a relaunch exactly as the fetch did, link tiles included', async () => {
    // Arrange
    serve(ko.data);
    const fetched = await fetchLayoutQuery();

    // Act
    const relaunched = warmStart();

    // Assert
    expect(fetched).toEqual(homeLayoutSchema.parse(ko.data));
    expect(relaunched).toEqual(fetched);
  });

  it('ignores a cache in the old format, and drops it on the next write', async () => {
    // Arrange
    const store = createMMKV({ id: 'skkuverse-cache' });
    store.set('home:layout:v1', JSON.stringify(homeLayoutSchema.parse(ko.data)));

    // Act
    const relaunched = warmStart();
    serve(ko.data);
    await fetchLayoutQuery();

    // Assert
    expect(relaunched).toBeUndefined();
    expect(store.contains('home:layout:v1')).toBe(false);
  });

  it('fails on a body that is not a layout, saying what is wrong with it', async () => {
    // Arrange
    serve({ version: 1 });

    // Act
    const fetching = fetchLayoutQuery();

    // Assert
    await expect(fetching).rejects.toThrow(/sections/);
  });
});

describe('fetchHomeLayout', () => {
  it('fails when the server is unreachable', async () => {
    // Arrange
    goOffline();

    // Act
    const fetching = fetchHomeLayout();

    // Assert
    await expect(fetching).rejects.toThrow();
  });
});
