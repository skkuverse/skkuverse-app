/**
 * The arrivals carry the server clock and when they arrived (review F1): the
 * response is `private, max-age=5`, so a refetch inside 5 s can be the HTTP
 * cache replaying the last body. Only the HTTP client is a double; a replay is
 * the same body again, its `serverNow` unchanged.
 */
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subwayArrivalsQueryOptions } from './subway.client';
import hyehwa from './__fixtures__/hyehwa.json';

const http = vi.hoisted(() => ({ serverNow: '' }));

vi.mock('../../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async () => ({ data: { meta: { lang: 'ko', serverNow: http.serverNow }, data: hyehwa.data } }),
  }),
}));

const SERVER_NOW = '2026-10-24T13:24:13+09:00';
const T0 = Date.parse('2026-10-24T04:24:13.400Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  http.serverNow = SERVER_NOW;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the arrivals clock', () => {
  it('reads the server clock and stamps the answer with when it arrived', async () => {
    // Act
    const data = await new QueryClient().fetchQuery(subwayArrivalsQueryOptions('hyehwa'));

    // Assert
    expect(data.serverNowMs).toBe(Date.parse(SERVER_NOW));
    expect(data.receivedAtMs).toBe(T0);
  });

  it('keeps the first arrival time for a body the HTTP cache replays, and takes a new one for a fresh body', async () => {
    // Arrange
    const client = new QueryClient();
    const options = subwayArrivalsQueryOptions('hyehwa');
    await client.fetchQuery(options);

    // Act
    vi.setSystemTime(T0 + 4_000);
    const replayed = await client.fetchQuery({ ...options, staleTime: 0 });
    vi.setSystemTime(T0 + 10_000);
    http.serverNow = '2026-10-24T13:24:23+09:00';
    const fresh = await client.fetchQuery({ ...options, staleTime: 0 });

    // Assert
    expect(replayed.receivedAtMs).toBe(T0);
    expect(fresh.receivedAtMs).toBe(T0 + 10_000);
  });
});
