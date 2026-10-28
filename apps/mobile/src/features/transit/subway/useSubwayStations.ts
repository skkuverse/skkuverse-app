import { useQuery } from '@tanstack/react-query';
import { subwayStationsQueryOptions } from './subway.client';

// WHY: `enabled: false` fetches nothing, for a screen composed without stations.
export function useSubwayStations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...subwayStationsQueryOptions(), enabled });
}
