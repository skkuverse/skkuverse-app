import { useQuery } from '@tanstack/react-query';
import { liveGroupQueryOptions } from '../transit.client';

export function useLiveGroup(liveEndpoint: string | undefined, refreshInterval = 15) {
  return useQuery(liveGroupQueryOptions(liveEndpoint, refreshInterval));
}
