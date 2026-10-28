import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrFallback } from '@skkuverse/shared';
import { MAP_CONFIG_KEY, mapConfigQueryOptions } from './map.client';
import { DEFAULT_MAP_CONFIG } from './map.constants';

export function useMapConfig() {
  const queryClient = useQueryClient();

  const query = useQuery(mapConfigQueryOptions());

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: MAP_CONFIG_KEY });

  return { ...query, data: dataOrFallback(query, DEFAULT_MAP_CONFIG), refresh };
}
