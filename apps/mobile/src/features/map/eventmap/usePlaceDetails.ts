import { useQuery } from '@tanstack/react-query';
import { placeDetailsQueryOptions } from './eventmap.client';

export function usePlaceDetails(overlayEndpoint: string | null) {
  return useQuery(placeDetailsQueryOptions(overlayEndpoint));
}
