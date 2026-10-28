import { useQuery } from '@tanstack/react-query';
import { buildingSearchQueryOptions } from './building.client';

export function useSearchBuildings(query: string, campus?: string) {
  return useQuery(buildingSearchQueryOptions(query, campus));
}
