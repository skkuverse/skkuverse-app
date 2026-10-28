import { useQuery } from '@tanstack/react-query';
import { noticeDetailQueryOptions } from './notices.client';

export function useNoticeDetail(sourceId: string | null, articleNo: number | null) {
  return useQuery(noticeDetailQueryOptions(sourceId, articleNo));
}
