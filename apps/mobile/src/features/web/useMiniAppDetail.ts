import { useQuery } from '@tanstack/react-query';
import { miniAppDetailQueryOptions } from './web.client';

export function useMiniAppDetail(id: string | undefined) {
  return useQuery({ ...miniAppDetailQueryOptions(id ?? ''), enabled: !!id });
}
