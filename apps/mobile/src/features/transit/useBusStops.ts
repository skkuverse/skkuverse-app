import { useQuery } from '@tanstack/react-query';
import { busStopsQueryOptions } from './transit.client';

// WHY: `enabled: false` fetches nothing, for a screen composed without stops.
export function useBusStops({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...busStopsQueryOptions(), enabled });
}
