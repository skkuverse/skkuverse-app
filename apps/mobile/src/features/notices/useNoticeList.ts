import { useInfiniteQuery } from '@tanstack/react-query';
import { noticeListQueryOptions, type NoticeListInputs } from './notices.client';

export function useNoticeList(inputs: NoticeListInputs) {
  return useInfiniteQuery(noticeListQueryOptions(inputs));
}
