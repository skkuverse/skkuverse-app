import { useQuery } from '@tanstack/react-query';
import { miniAppIndexQueryOptions } from './web.client';

export function useMiniAppIndex() {
  return useQuery(miniAppIndexQueryOptions());
}
