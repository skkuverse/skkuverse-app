/**
 * The query keys and timings the transit client builds, pinned as literals,
 * so a move or a port can never split one cache into two, merge two into
 * one, or change how often a screen polls.
 */
import { describe, expect, it } from 'vitest';
import { Failure } from '@skkuverse/shared';
import {
  busConfigQueryOptions,
  busStopsQueryOptions,
  liveGroupQueryOptions,
  smartScheduleQueryOptions,
  stopArrivalsQueryOptions,
  transitLayoutQueryOptions,
} from './transit.client';

describe('transit query options', () => {
  it('keys a bus config by its group, cached for five minutes', () => {
    // Act
    const options = busConfigQueryOptions('jongro07');

    // Assert
    expect(options.queryKey).toStrictEqual(['bus', 'config', 'jongro07']);
    expect(options.staleTime).toBe(300_000);
    expect(options.gcTime).toBe(1_800_000);
    expect(options.enabled).toBe(true);
  });

  it('polls a live line by its endpoint at the group interval, never in the background', () => {
    // Act
    const options = liveGroupQueryOptions('/bus/live/jongro07', 20);

    // Assert
    expect(options.queryKey).toStrictEqual(['bus', 'live', '/bus/live/jongro07']);
    expect(options.refetchInterval).toBe(20_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.staleTime).toBe(0);
  });

  it('polls a live line every 15 s when the group names no interval', () => {
    // Act
    const options = liveGroupQueryOptions('/bus/live/jongro07');

    // Assert
    expect(options.refetchInterval).toBe(15_000);
  });

  it('keys a schedule by its endpoint, stale after 30 s, refreshed only when asked', () => {
    // Act
    const plain = smartScheduleQueryOptions('/bus/schedule/commute');
    const refreshing = smartScheduleQueryOptions('/bus/schedule/commute', { refetchIntervalMs: 60_000 });

    // Assert
    expect(plain.queryKey).toStrictEqual(['bus', 'schedule', '/bus/schedule/commute']);
    expect(plain.staleTime).toBe(30_000);
    expect(plain.refetchInterval).toBe(false);
    expect(refreshing.refetchInterval).toBe(60_000);
    expect(refreshing.refetchIntervalInBackground).toBe(false);
  });

  it('keys the tab layout alone, stale after five minutes', () => {
    // Act
    const options = transitLayoutQueryOptions();

    // Assert
    expect(options.queryKey).toStrictEqual(['transit', 'layout']);
    expect(options.staleTime).toBe(300_000);
  });

  it('keys the stop list alone, cached for the server\u2019s five minutes', () => {
    // Act
    const options = busStopsQueryOptions();

    // Assert
    expect(options.queryKey).toStrictEqual(['bus', 'stops']);
    expect(options.staleTime).toBe(300_000);
    expect(options.gcTime).toBe(1_800_000);
  });

  it('polls a stop page by its id at the given interval, never in the background', () => {
    // Act
    const options = stopArrivalsQueryOptions('seoul-01592', 20);

    // Assert
    expect(options.queryKey).toStrictEqual(['bus', 'stopArrivals', 'seoul-01592']);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.staleTime).toBe(0);
    expect(options.enabled).toBe(true);
    const interval = options.refetchInterval;
    if (typeof interval !== 'function') throw new Error('expected the interval to read the query');
    expect(interval({ state: { error: null } } as never)).toBe(20_000);
  });

  it('polls a stop page every 15 s when no interval is given, and stops once the stop is gone', () => {
    // Act
    const interval = stopArrivalsQueryOptions('seoul-99999').refetchInterval;

    // Assert
    if (typeof interval !== 'function') throw new Error('expected the interval to read the query');
    expect(interval({ state: { error: null } } as never)).toBe(15_000);
    expect(interval({ state: { error: Failure.server(404, 'not found', 'BUS_STOP_NOT_FOUND') } } as never)).toBe(false);
    expect(interval({ state: { error: Failure.server(503, 'unavailable', 'BUS_STOPS_UNAVAILABLE') } } as never)).toBe(15_000);
  });

  it('runs no query without its id', () => {
    // Assert
    expect(busConfigQueryOptions(undefined).enabled).toBe(false);
    expect(liveGroupQueryOptions(undefined).enabled).toBe(false);
    expect(smartScheduleQueryOptions(undefined).enabled).toBe(false);
    expect(stopArrivalsQueryOptions(undefined).enabled).toBe(false);
  });
});
