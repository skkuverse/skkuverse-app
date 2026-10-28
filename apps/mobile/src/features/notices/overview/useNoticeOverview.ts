import { useQuery } from '@tanstack/react-query';
import { noticeOverviewQueryOptions, type NoticeOverviewInputs } from '../notices.client';

export function useNoticeOverview(inputs: NoticeOverviewInputs) {
  return useQuery(noticeOverviewQueryOptions(inputs));
}
