/**
 * `/map/config` keeps a last-known-good copy (review note, 2026-10-23): a
 * relaunch on a slow network paints the served chips and campuses at once
 * instead of the bundled defaults, which carry no chips. Only the HTTP client
 * and MMKV are doubles; the cache's generic behavior is cachedQueryOptions'
 * own suite.
 */
import { QueryClient } from '@tanstack/react-query';
import { parseOrThrow } from '@skkuverse/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapConfigQueryOptions } from './map.client';
import { mapConfigSchema } from './map-config.schema';
import baseChips from './__fixtures__/server-map-config.base-chips-ko.json';

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

const SERVED = parseOrThrow(mapConfigSchema, baseChips.data, 'map.config');

/** A fresh client, as on a relaunch, with retries off as the app has them. */
function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  stored.clear();
  http.routes.clear();
  http.down = false;
});

describe('the map config copy', () => {
  it('lets a relaunch with the network down show the chips and campuses last served', async () => {
    // Arrange
    http.routes.set('/map/config', baseChips.data);
    await newClient().fetchQuery(mapConfigQueryOptions());
    http.down = true;
    const relaunch = newClient();
    const options = mapConfigQueryOptions();

    // Act
    await relaunch.fetchQuery(options).catch(() => undefined);

    // Assert
    const data = relaunch.getQueryData(options.queryKey);
    expect(data?.chips.map((c) => c.id)).toEqual(SERVED.chips.map((c) => c.id));
    expect(data?.campuses).toEqual(SERVED.campuses);
    expect(relaunch.getQueryState(options.queryKey)?.status).toBe('error');
  });

  it('has no data after a failed fetch with nothing cached, so the hook applies the defaults', async () => {
    // Arrange
    http.down = true;
    const client = newClient();
    const options = mapConfigQueryOptions();

    // Act
    await client.fetchQuery(options).catch(() => undefined);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'error', data: undefined });
  });

  it('keeps the stored copy when the server answers with no readable layer', async () => {
    // Arrange
    http.routes.set('/map/config', baseChips.data);
    await newClient().fetchQuery(mapConfigQueryOptions());
    const unreadable = baseChips.data.layers.map((l) => ({ ...l, defaultVisibleWhen: { kind: 'seasonal' } }));
    http.routes.set('/map/config', { ...baseChips.data, layers: unreadable });
    await newClient().fetchQuery(mapConfigQueryOptions()).catch(() => undefined);
    http.down = true;
    const relaunch = newClient();
    const options = mapConfigQueryOptions();

    // Act
    await relaunch.fetchQuery(options).catch(() => undefined);

    // Assert
    const data = relaunch.getQueryData(options.queryKey);
    expect(data?.chips.map((c) => c.id)).toEqual(SERVED.chips.map((c) => c.id));
    expect(data?.layers).toEqual(SERVED.layers);
  });

  it('seeds the query stale, so a relaunch still asks the server at once', async () => {
    // Arrange
    http.routes.set('/map/config', baseChips.data);
    await newClient().fetchQuery(mapConfigQueryOptions());
    http.down = true;
    const client = newClient();
    const options = mapConfigQueryOptions();

    // Act
    await client.ensureQueryData(options);

    // Assert
    expect(client.getQueryState(options.queryKey)).toMatchObject({ status: 'success', dataUpdatedAt: 0 });
  });
});
