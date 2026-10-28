/**
 * The mini-app registry queries over the real client, schema and cache (ADR
 * 0020 D7): the cache keeps what the server sent and seeds the query, and a
 * failed fetch is a failure. The cache's generic behavior is
 * cachedQueryOptions' own suite; only the HTTP client and MMKV are doubles here.
 */
import { QueryClient } from '@tanstack/react-query';
import { DEFAULT_SHELL } from '@skkuverse/miniapp/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { miniAppDetailQueryOptions, miniAppFeedQueryOptions, miniAppIndexQueryOptions } from './web.client';
import { miniAppDetailSchema, miniAppIndexSchema } from './web.schema';
import indexKo from './__fixtures__/miniapp-index.production-ko.json';
import eskara from './__fixtures__/miniapp-detail.eskara-2026.json';
import hssc from './__fixtures__/miniapp-detail.hssc.json';
import feedKo from './__fixtures__/miniapp-feed.production-ko.json';

const stored = vi.hoisted(() => new Map<string, string>());
const http = vi.hoisted(() => ({ routes: new Map<string, unknown>(), down: false }));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => stored.get(key),
    set: (key: string, value: string) => {
      stored.set(key, value);
    },
    remove: (key: string) => stored.delete(key),
  }),
}));

vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      if (http.down || !http.routes.has(path)) {
        throw Object.assign(new Error('Network Error'), { isAxiosError: true });
      }
      return { data: { meta: { lang: 'ko' }, data: http.routes.get(path) } };
    },
  }),
}));

const INDEX_KEY = 'miniapp:index:v3';
const detailKey = (id: string) => `miniapp:detail:v3:${id}`;

function serve(path: string, data: unknown): void {
  http.down = false;
  http.routes.set(path, data);
}

function goOffline(): void {
  http.down = true;
}

function cache(key: string, value: unknown): void {
  stored.set(key, JSON.stringify(value));
}

function cached(key: string): unknown {
  const raw = stored.get(key);
  return raw === undefined ? undefined : JSON.parse(raw);
}

/** A fresh client, as on a relaunch, with retries off as the app has them. */
function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** The query's seed, read from the cache alone. */
function seedOf(options: { initialData?: unknown }): unknown {
  const { initialData } = options;
  return typeof initialData === 'function' ? (initialData as () => unknown)() : initialData;
}

beforeEach(() => {
  stored.clear();
  http.routes.clear();
  http.down = false;
});

describe('the mini-app index query', () => {
  it('reads the published index, ordered, and a relaunch paints the same entries', async () => {
    // Arrange
    serve('/miniapps', indexKo.data);
    const client = newClient();

    // Act
    const fetched = await client.fetchQuery(miniAppIndexQueryOptions());
    const relaunched = seedOf(miniAppIndexQueryOptions());

    // Assert
    expect(fetched).toEqual([
      {
        id: 'eskara-2026',
        name: '축제 가이드',
        order: 4,
        homeLogo: { kind: 'emoji', emoji: '📖' },
        shellLogo: { kind: 'remote', uri: 'https://media.skkuverse.com/miniapps/eskara-2026/logo-03a86934.jpg' },
        hidden: true,
      },
      {
        id: 'mukja',
        name: '음식 룰렛',
        order: 8,
        homeLogo: { kind: 'emoji', emoji: '😋' },
        shellLogo: { kind: 'emoji', emoji: '😋' },
        hidden: true,
      },
      {
        id: 'hssc',
        name: '인사캠 총학생회',
        shortName: '인사캠 총학',
        order: 10,
        homeLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc.png' },
        shellLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc.png' },
        hidden: true,
      },
    ]);
    expect(relaunched).toEqual(fetched);
  });

  it('ignores a parsed copy in an older format, and drops it on the next write', async () => {
    // Arrange
    const parsedLongAgo = miniAppIndexSchema.parse(indexKo.data);
    cache('miniapp:index:v2', parsedLongAgo);
    cache('miniapp:index:v1', parsedLongAgo);

    // Act
    const relaunched = seedOf(miniAppIndexQueryOptions());
    serve('/miniapps', indexKo.data);
    await newClient().fetchQuery(miniAppIndexQueryOptions());

    // Assert
    expect(relaunched).toBeUndefined();
    expect(stored.has('miniapp:index:v2')).toBe(false);
    expect(stored.has('miniapp:index:v1')).toBe(false);
    expect(cached(INDEX_KEY)).toEqual(indexKo.data);
  });

  it('seeds a relaunch from the raw copy, stale, so it refetches at once', async () => {
    // Arrange
    cache(INDEX_KEY, indexKo.data);
    goOffline();
    const client = newClient();
    const options = miniAppIndexQueryOptions();

    // Act
    await client.ensureQueryData(options);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({
      status: 'success',
      data: miniAppIndexSchema.parse(indexKo.data).miniApps,
      dataUpdatedAt: 0,
    });
  });

  it('reports a failed fetch as a failure and keeps showing the cached entries', async () => {
    // Arrange
    cache(INDEX_KEY, indexKo.data);
    goOffline();
    const client = newClient();
    const options = miniAppIndexQueryOptions();

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({
      status: 'error',
      data: miniAppIndexSchema.parse(indexKo.data).miniApps,
    });
  });

  it('has no data after a failed fetch with nothing cached', async () => {
    // Arrange
    goOffline();
    const client = newClient();
    const options = miniAppIndexQueryOptions();

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'error', data: undefined });
  });

  it('fails on an index with no entries, and keeps the cache', async () => {
    // Arrange
    cache(INDEX_KEY, indexKo.data);
    serve('/miniapps', { version: 1, miniApps: [] });

    // Act
    const fetching = newClient().fetchQuery(miniAppIndexQueryOptions());

    // Assert
    await expect(fetching).rejects.toThrow(INDEX_KEY);
    expect(cached(INDEX_KEY)).toEqual(indexKo.data);
  });

  it.each([null, 42, 'nope', {}, { miniApps: 'no' }])('fails on a malformed envelope %j, and keeps the cache', async (body) => {
    // Arrange
    cache(INDEX_KEY, indexKo.data);
    serve('/miniapps', body);

    // Act
    const fetching = newClient().fetchQuery(miniAppIndexQueryOptions());

    // Assert
    await expect(fetching).rejects.toThrow(INDEX_KEY);
    expect(cached(INDEX_KEY)).toEqual(indexKo.data);
  });

  it('seeds nothing from a cached index with no entries', () => {
    // Arrange
    cache(INDEX_KEY, { version: 1, miniApps: [] });

    // Act
    const relaunched = seedOf(miniAppIndexQueryOptions());

    // Assert
    expect(relaunched).toBeUndefined();
  });
});

describe('the mini-app detail query', () => {
  it.each([
    ['eskara-2026', eskara.data, 'https://eskara.miniapp.skkuverse.com/eskara'],
    ['hssc', hssc.data, 'https://student.skku.edu/student/notice2.do'],
  ])('reads the published detail of %s', async (id, data, startUrl) => {
    // Arrange
    serve(`/miniapps/${id}`, data);

    // Act
    const fetched = await newClient().fetchQuery(miniAppDetailQueryOptions(id));

    // Assert
    expect(fetched).toEqual({
      version: 1,
      id,
      startUrl,
      verified: true,
      relatedLinks: [],
      shell: { bar: 'bottom', header: 'opaque', statusBar: 'dark', background: '#FFFFFF' },
    });
  });

  it("ignores a parsed copy an older build wrote, so the server's shell wins", async () => {
    // Arrange
    const id = 'eskara-2026';
    const parsedByAnOldShellParser = { ...miniAppDetailSchema.parse(eskara.data), shell: DEFAULT_SHELL };
    cache(`miniapp:detail:v2:${id}`, parsedByAnOldShellParser);
    cache(`miniapp:detail:v1:${id}`, parsedByAnOldShellParser);
    const barless = { ...eskara.data, shell: { ...eskara.data.shell, bar: 'none' } };

    // Act
    const relaunched = seedOf(miniAppDetailQueryOptions(id));
    serve(`/miniapps/${id}`, barless);
    const fetched = await newClient().fetchQuery(miniAppDetailQueryOptions(id));

    // Assert
    expect(relaunched).toBeUndefined();
    expect(fetched.shell.bar).toBe('none');
    expect(stored.has(`miniapp:detail:v2:${id}`)).toBe(false);
    expect(stored.has(`miniapp:detail:v1:${id}`)).toBe(false);
  });

  it('keeps one copy per mini app', async () => {
    // Arrange
    serve('/miniapps/eskara-2026', eskara.data);
    serve('/miniapps/hssc', hssc.data);
    const client = newClient();

    // Act
    await client.fetchQuery(miniAppDetailQueryOptions('eskara-2026'));
    await client.fetchQuery(miniAppDetailQueryOptions('hssc'));

    // Assert
    expect(cached(detailKey('eskara-2026'))).toEqual(eskara.data);
    expect(cached(detailKey('hssc'))).toEqual(hssc.data);
    expect(seedOf(miniAppDetailQueryOptions('hssc'))).toMatchObject({ id: 'hssc' });
  });

  it('keeps the cached copy for a deep link when its fetch fails offline', async () => {
    // Arrange
    cache(detailKey('hssc'), hssc.data);
    goOffline();
    const client = newClient();
    const options = miniAppDetailQueryOptions('hssc');

    // Act
    const opening = client.query({ ...options, staleTime: 0 });

    // Assert
    await expect(opening).rejects.toThrow();
    expect(client.getQueryData(options.queryKey)).toMatchObject({ id: 'hssc', startUrl: hssc.data.startUrl });
  });

  it('fails a deep link with nothing cached when the lookup fails', async () => {
    // Arrange
    goOffline();
    const client = newClient();
    const options = miniAppDetailQueryOptions('hssc');

    // Act
    const opening = client.query({ ...options, staleTime: 0 });

    // Assert
    await expect(opening).rejects.toThrow();
    expect(client.getQueryData(options.queryKey)).toBeUndefined();
  });
});

describe('the mini-app feed query', () => {
  it('keeps the entries already loaded when a refetch fails', async () => {
    // Arrange
    serve('/miniapps/eskara-2026/notifications', feedKo.data);
    const client = newClient();
    const options = miniAppFeedQueryOptions('eskara-2026');
    const loaded = await client.fetchQuery(options);
    goOffline();

    // Act
    await client.refetchQueries({ queryKey: options.queryKey });

    // Assert
    expect(loaded).toHaveLength(feedKo.data.length);
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'error', data: loaded });
  });
});
