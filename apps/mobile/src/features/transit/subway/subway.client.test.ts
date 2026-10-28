/**
 * The subway arrivals query, pinned as literals so a move or a port can never
 * split its cache or change how often the screen polls.
 */
import { describe, expect, it } from 'vitest';
import { subwayArrivalsQueryOptions, subwayStationsQueryOptions } from './subway.client';

describe('subway arrivals query options', () => {
  it('keys arrivals by station and polls every 10 s, never in the background', () => {
    // Act
    const options = subwayArrivalsQueryOptions('jeongja');

    // Assert
    expect(options.queryKey).toStrictEqual(['subway', 'arrivals', 'jeongja']);
    expect(options.refetchInterval).toBe(10_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.staleTime).toBe(0);
    expect(options.enabled).toBe(true);
  });

  it('runs no query without a station', () => {
    // Assert
    expect(subwayArrivalsQueryOptions(undefined).enabled).toBe(false);
  });
});

describe('subway stations query options', () => {
  it('keys the station list once and keeps it no longer than the server’s max-age=300', () => {
    // Act
    const options = subwayStationsQueryOptions();

    // Assert
    expect(options.queryKey).toStrictEqual(['subway', 'stations']);
    expect(options.staleTime).toBe(5 * 60_000);
  });
});
