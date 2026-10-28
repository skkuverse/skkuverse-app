import { useQuery } from '@tanstack/react-query';
import { layerOverlaysQueryOptions } from './map.client';

export function useLayerOverlays(endpoint: string, enabled: boolean) {
  return useQuery(layerOverlaysQueryOptions(endpoint, enabled));
}
