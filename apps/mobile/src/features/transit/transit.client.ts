import { queryOptions } from '@tanstack/react-query';
import {
  API_TIMEOUT_MS,
  ApiEndpoints,
  Failure,
  nextSnapshot,
  parseOrThrow,
  safeGet,
  safeGetConditional,
  type AppFailure,
  type ConditionalSnapshot,
  type ServerFailure,
} from '@skkuverse/shared';
import { transitLayoutSchema } from './layout.schema';
import { liveGroupSchema } from './live.schema';
import { busStopsSchema, stopArrivalsSchema } from './stops.schema';
import { smartScheduleSchema } from './smart-schedule.schema';
import { busGroupSchema } from './bus-config.schema';
import type { BusGroup, BusStop, LiveGroup, SmartSchedule, StopArrivals, TransitLayout } from './transit.types';

export const BUS_CONFIG_KEY = ['bus', 'config'] as const;
export const LIVE_GROUP_KEY = ['bus', 'live'] as const;
export const SMART_SCHEDULE_KEY = ['bus', 'schedule'] as const;
export const BUS_STOPS_KEY = ['bus', 'stops'] as const;
export const STOP_ARRIVALS_KEY = ['bus', 'stopArrivals'] as const;
export const TRANSIT_LAYOUT_KEY = ['transit', 'layout'] as const;

export function busConfigQueryOptions(groupId: string | undefined) {
  return queryOptions<BusGroup>({
    queryKey: [...BUS_CONFIG_KEY, groupId],
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.busConfigGroup(groupId!), (envelope) =>
        parseOrThrow(busGroupSchema, envelope.data, 'GET /bus/config/:groupId'),
      );

      if (result.ok) {
        return result.data;
      }

      throw result.failure;
    },
    enabled: !!groupId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function liveGroupQueryOptions(liveEndpoint: string | undefined, refreshInterval = 15) {
  return queryOptions<LiveGroup>({
    queryKey: [...LIVE_GROUP_KEY, liveEndpoint],
    queryFn: async () => {
      // WHY: short enough that a stalled poll and its retry finish before the next interval is due.
      const result = await safeGet(liveEndpoint!, (envelope) => parseOrThrow(liveGroupSchema, envelope, 'GET bus live'), {
        timeout: API_TIMEOUT_MS.realtime,
      });

      if (result.ok) {
        return result.data;
      }

      throw result.failure;
    },
    enabled: !!liveEndpoint,
    refetchInterval: refreshInterval * 1000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

// WHY: one body for every language; staleTime matches the server's `max-age`.
export function busStopsQueryOptions() {
  return queryOptions<BusStop[]>({
    queryKey: BUS_STOPS_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.busStops(), (envelope) =>
        parseOrThrow(busStopsSchema, envelope.data, 'GET /bus/stops'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function isStopGone(error: unknown): boolean {
  return (error as AppFailure | null)?.type === 'server' && (error as ServerFailure).statusCode === 404;
}

// WHY: a failed poll keeps the last good page, except a 404, which ends the polling: the stop is gone.
export function stopArrivalsQueryOptions(stopId: string | undefined, refreshInterval = 15) {
  return queryOptions<StopArrivals>({
    queryKey: [...STOP_ARRIVALS_KEY, stopId],
    queryFn: async () => {
      const result = await safeGet(
        ApiEndpoints.busStopArrivals(stopId!),
        (envelope) => parseOrThrow(stopArrivalsSchema, envelope, 'GET /bus/stops/:stopId/arrivals'),
        { timeout: API_TIMEOUT_MS.realtime },
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    enabled: !!stopId,
    refetchInterval: (query) => (isStopGone(query.state.error) ? false : refreshInterval * 1000),
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

type SmartScheduleSnapshot = ConditionalSnapshot<SmartSchedule>;

const selectSchedule = (snapshot: SmartScheduleSnapshot) => snapshot.data;

export interface SmartScheduleOptions {
  // WHY: set from the service's `refresh` alone, never per caller.
  refetchIntervalMs?: number | false;
}

/**
 * QUIRK(react-native): on iOS a plain GET repeated within `max-age` is answered from the device cache,
 * so a refresh sends `If-None-Match`; a request carrying it skips the local cache (`RCTNetworking.mm`).
 */
export function smartScheduleQueryOptions(endpoint: string | undefined, options: SmartScheduleOptions = {}) {
  return queryOptions({
    queryKey: [...SMART_SCHEDULE_KEY, endpoint],
    queryFn: async ({ client, queryKey }) => {
      const previous = client.getQueryData<SmartScheduleSnapshot>(queryKey);
      const result = await safeGetConditional(endpoint!, (envelope) => parseOrThrow(smartScheduleSchema, envelope.data, 'GET smart schedule'), {
        ifNoneMatch: previous?.etag ?? undefined,
      });

      if (!result.ok) throw result.failure;

      const next = nextSnapshot(previous, result.data);
      if (!next) throw Failure.parse('304 for a schedule that is not cached');
      return next;
    },
    select: selectSchedule,
    enabled: !!endpoint,
    // WHY: at most the server's `max-age` on the smart view.
    staleTime: 30_000,
    refetchInterval: options.refetchIntervalMs ?? false,
    refetchIntervalInBackground: false,
  });
}

// WHY: the server's `Cache-Control: max-age=300` on the same response.
const LAYOUT_STALE_TIME = 5 * 60 * 1000;

export function transitLayoutQueryOptions() {
  return queryOptions<TransitLayout>({
    queryKey: TRANSIT_LAYOUT_KEY,
    queryFn: async () => {
      // WHY: not a layout at all fails the parse: an error with retry, never an empty tab.
      const result = await safeGet(ApiEndpoints.homeTransit(), (envelope) =>
        parseOrThrow(transitLayoutSchema, envelope.data, 'GET /ui/home/transit'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: LAYOUT_STALE_TIME,
  });
}
