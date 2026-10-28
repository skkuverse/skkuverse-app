import { router } from 'expo-router';
import { markTabSwitch } from '@/platform/analytics';
import type { ThisWeekItem } from './this-week.types';

/** WHY: the map stays put (umbrella ADR 0010 D6). */
export function openThisWeekNotice(item: ThisWeekItem): void {
  router.push({
    pathname: '/notices/[sourceId]/[articleNo]',
    params: { sourceId: item.sourceId, articleNo: String(item.articleNo) },
  });
}

export function openThisWeekPage(): void {
  router.push('/this-week');
}

export function openNoticesTab(): void {
  markTabSwitch('notices', 'sheet');
  router.navigate('/(tabs)/notices');
}
