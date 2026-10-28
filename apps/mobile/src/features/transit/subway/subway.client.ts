import { queryOptions } from '@tanstack/react-query';
import {
  API_TIMEOUT_MS,
  ApiEndpoints,
  parseOrThrow,
  safeGet,
} from '@skkuverse/shared';
import { receiptOf } from '../server-clock.rules';
import { subwayArrivalsMetaSchema, subwayArrivalsSchema, subwayStationsSchema } from './subway.schema';
import type { SubwayArrivalsAnswer, SubwayStation } from './subway.types';

export const SUBWAY_ARRIVALS_KEY = ['subway', 'arrivals'] as const;
export const SUBWAY_STATIONS_KEY = ['subway', 'stations'] as const;

// EVIDENCE: the server answers `private, max-age=300` and changes it only with a deploy or a coords push.
export function subwayStationsQueryOptions() {
  return queryOptions<SubwayStation[]>({
    queryKey: SUBWAY_STATIONS_KEY,
    queryFn: async () => {
      const result = await safeGet(ApiEndpoints.subwayStations(), (envelope) =>
        parseOrThrow(subwayStationsSchema, envelope.data, 'GET /subway/stations'),
      );
      if (result.ok) return result.data;
      throw result.failure;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

const REFETCH_INTERVAL_MS = 10_000;

// EVIDENCE: the server answers `private, max-age=5`, so a refetch may replay the last body; the body keeps
// the arrival time of the one it copies, so the clock offset is not read low (`receiptOf`).
export function subwayArrivalsQueryOptions(stationId: string | undefined) {
  return queryOptions<SubwayArrivalsAnswer>({
    queryKey: [...SUBWAY_ARRIVALS_KEY, stationId],
    queryFn: async ({ client, queryKey }) => {
      // WHY: short enough that a stalled poll and its retry finish before the next
      // interval is due — see the invariant in api/timeouts.ts.
      const result = await safeGet(
        ApiEndpoints.subwayArrivals(stationId!),
        (envelope) => ({
          ...parseOrThrow(subwayArrivalsSchema, envelope.data, 'GET /subway/stations/:id/arrivals'),
          ...parseOrThrow(subwayArrivalsMetaSchema, envelope.meta, 'GET /subway/stations/:id/arrivals meta'),
        }),
        {
          timeout: API_TIMEOUT_MS.realtime,
        },
      );
      if (!result.ok) throw result.failure;
      const held = client.getQueryData<SubwayArrivalsAnswer>(queryKey);
      return { ...result.data, receivedAtMs: receiptOf(held, result.data.serverNowMs, Date.now()) };
    },
    enabled: !!stationId,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}
