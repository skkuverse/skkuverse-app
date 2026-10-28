import { useInfiniteQuery } from '@tanstack/react-query';
import {
  multiSourceNoticeListQueryOptions,
  type MultiSourceNoticeListInputs,
} from './notices.client';

export function useMultiSourceNoticeList(inputs: MultiSourceNoticeListInputs) {
  return useInfiniteQuery(multiSourceNoticeListQueryOptions(inputs));
}
