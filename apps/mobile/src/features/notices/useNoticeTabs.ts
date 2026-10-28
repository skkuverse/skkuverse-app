import { useQuery } from '@tanstack/react-query';
import { noticeTabsQueryOptions } from './notices.client';

export function useNoticeTabs() {
  return useQuery(noticeTabsQueryOptions());
}
