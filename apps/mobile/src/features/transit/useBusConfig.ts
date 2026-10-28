import { useQuery } from '@tanstack/react-query';
import { busConfigQueryOptions } from './transit.client';

export function useBusConfig(groupId: string | undefined) {
  return useQuery(busConfigQueryOptions(groupId));
}
