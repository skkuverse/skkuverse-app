import { useQuery } from '@tanstack/react-query';
import { subwayArrivalsQueryOptions } from './subway.client';

export function useSubwayArrivals(stationId: string | undefined) {
  return useQuery(subwayArrivalsQueryOptions(stationId));
}
