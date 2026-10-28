/**
 * The games registry queries over the real client, schema and cache (ADR 0020
 * D7): the cache keeps what the server sent and seeds the query, and a failed
 * fetch keeps it. Only the HTTP client and MMKV are doubles.
 */
import { QueryClient } from '@tanstack/react-query';
import { readCache, writeCache } from '@skkuverse/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMMKV } from '../../../test-support/react-native-mmkv';
import { gameDetailQueryOptions, gameIndexQueryOptions } from './games.client';
import listed from './__fixtures__/game-index.apple-game-listed.json';
import empty from './__fixtures__/game-index.empty.json';
import appleGame from './__fixtures__/game-detail.apple-game.json';

const http = vi.hoisted(() => ({ routes: new Map<string, unknown>(), down: false }));

vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      if (http.down) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
      if (!http.routes.has(path)) {
        throw Object.assign(new Error('Not Found'), {
          isAxiosError: true,
          response: { status: 404, data: { error: { code: 'GAME_NOT_FOUND', message: 'no such game' } } },
        });
      }
      return { data: { meta: {}, data: http.routes.get(path) } };
    },
  }),
}));

const INDEX_KEY = 'games:index:v1';

function serve(path: string, data: unknown): void {
  http.down = false;
  http.routes.set(path, data);
}

/** A fresh client, as on a relaunch, with retries off as the app has them. */
function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const raw = (key: string): unknown => readCache(key, (value) => value);

beforeEach(() => {
  resetMMKV();
  http.routes.clear();
  http.down = false;
});

describe('the game index query', () => {
  it('reads every listed entry in the dataset order, disabled ones included', async () => {
    // Arrange
    serve('/games', listed.data);

    // Act
    const index = await newClient().fetchQuery(gameIndexQueryOptions());

    // Assert
    expect(index).toStrictEqual([
      { id: 'apple-game', entryUrl: 'https://apple-game.game.skkuverse.com/', enabled: true, minHostProtocol: 1 },
      { id: 'suika-game', entryUrl: 'https://suika-game.game.skkuverse.com/', enabled: false, minHostProtocol: 1 },
    ]);
    expect(raw(INDEX_KEY)).toStrictEqual(listed.data);
  });

  it('reads an empty registry as a real answer, and caches it', async () => {
    // Arrange
    serve('/games', empty.data);

    // Act
    const index = await newClient().fetchQuery(gameIndexQueryOptions());

    // Assert
    expect(index).toStrictEqual([]);
    expect(raw(INDEX_KEY)).toStrictEqual(empty.data);
  });

  it('keeps showing the cached copy when the fetch fails', async () => {
    // Arrange
    writeCache(INDEX_KEY, listed.data);
    http.down = true;
    const client = newClient();
    const options = gameIndexQueryOptions();

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({
      status: 'error',
      data: [expect.objectContaining({ id: 'apple-game' }), expect.objectContaining({ id: 'suika-game' })],
    });
  });

  it('seeds a relaunch from the cached copy, stale, so it refetches at once', async () => {
    // Arrange
    writeCache(INDEX_KEY, listed.data);
    http.down = true;
    const client = newClient();
    const options = gameIndexQueryOptions();

    // Act
    await client.ensureQueryData(options);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'success', dataUpdatedAt: 0 });
  });

  it('has no data after a failed fetch with nothing cached', async () => {
    // Arrange
    http.down = true;
    const client = newClient();
    const options = gameIndexQueryOptions();

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'error', data: undefined });
  });

  it.each([null, 42, 'nope', {}, { games: 'no' }])('fails on a malformed body %j, and keeps the cache', async (body) => {
    // Arrange
    writeCache(INDEX_KEY, listed.data);
    serve('/games', body);

    // Act
    const fetching = newClient().fetchQuery(gameIndexQueryOptions());

    // Assert
    await expect(fetching).rejects.toThrow(INDEX_KEY);
    expect(raw(INDEX_KEY)).toStrictEqual(listed.data);
  });

  it('drops an entry without a usable id, and ignores keys it does not know', async () => {
    // Arrange
    serve('/games', {
      games: [
        { id: 'apple-game', entryUrl: 'https://apple-game.game.skkuverse.com/', enabled: true, minHostProtocol: 1, ranked: true },
        { entryUrl: 'https://x.game.skkuverse.com/', enabled: true, minHostProtocol: 1 },
        { id: 'Not A Slug', entryUrl: 'https://y.game.skkuverse.com/', enabled: true, minHostProtocol: 1 },
        'suika-game',
        null,
      ],
      version: 2,
    });

    // Act
    const index = await newClient().fetchQuery(gameIndexQueryOptions());

    // Assert
    expect(index).toStrictEqual([
      { id: 'apple-game', entryUrl: 'https://apple-game.game.skkuverse.com/', enabled: true, minHostProtocol: 1 },
    ]);
  });

  it('keeps a listed entry whose other fields are unreadable, read as the values that hide it', async () => {
    // Arrange
    serve('/games', {
      games: [
        { id: 'apple-game', entryUrl: 'http://apple-game.game.skkuverse.com/', enabled: 'yes', minHostProtocol: 0 },
        { id: 'suika-game' },
        { id: 'wave-run', entryUrl: 'javascript:alert(1)', enabled: true, minHostProtocol: 1.5 },
      ],
    });

    // Act
    const index = await newClient().fetchQuery(gameIndexQueryOptions());

    // Assert
    expect(index).toStrictEqual([
      { id: 'apple-game', entryUrl: null, enabled: false, minHostProtocol: null },
      { id: 'suika-game', entryUrl: null, enabled: false, minHostProtocol: null },
      { id: 'wave-run', entryUrl: null, enabled: true, minHostProtocol: null },
    ]);
  });
});

describe('the game detail query', () => {
  it('reads one published entry and caches it', async () => {
    // Arrange
    serve('/games/apple-game', appleGame.data);

    // Act
    const entry = await newClient().fetchQuery(gameDetailQueryOptions('apple-game'));

    // Assert
    expect(entry).toStrictEqual({
      id: 'apple-game',
      entryUrl: 'https://apple-game.game.skkuverse.com/',
      enabled: true,
      minHostProtocol: 1,
    });
    expect(raw('games:detail:v1:apple-game')).toStrictEqual(appleGame.data);
  });

  it('fails on an id the registry does not list', async () => {
    // Act
    const fetching = newClient().fetchQuery(gameDetailQueryOptions('wave-run'));

    // Assert
    await expect(fetching).rejects.toThrow('Game wave-run request failed');
  });

  it('keeps showing the cached entry when the fetch fails', async () => {
    // Arrange
    writeCache('games:detail:v1:apple-game', appleGame.data);
    http.down = true;
    const client = newClient();
    const options = gameDetailQueryOptions('apple-game');

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({
      status: 'error',
      data: expect.objectContaining({ id: 'apple-game', enabled: true }),
    });
  });
});
