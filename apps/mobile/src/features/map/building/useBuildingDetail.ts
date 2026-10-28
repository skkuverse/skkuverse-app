import { useQuery } from '@tanstack/react-query';
import { buildingDetailQueryOptions } from './building.client';

export function useBuildingDetail(skkuId: number | null) {
  return useQuery(buildingDetailQueryOptions(skkuId));
}
