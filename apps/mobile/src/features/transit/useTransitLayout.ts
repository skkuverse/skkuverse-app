import { useQuery } from '@tanstack/react-query';
import { transitLayoutQueryOptions } from './transit.client';

export function useTransitLayout() {
  return useQuery(transitLayoutQueryOptions());
}
