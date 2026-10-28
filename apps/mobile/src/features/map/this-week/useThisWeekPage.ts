import { useT } from '@skkuverse/shared';
import { useSelectedCampus } from '../useSelectedCampus';
import { THIS_WEEK_WEEKS } from './this-week.constants';
import { toSectionTexts, toThisWeekFeed } from './this-week.rules';
import { openNoticesTab, openThisWeekNotice } from './this-week.service';
import { useThisWeekStore } from './this-week.store';

export function useThisWeekPage() {
  const { t, tpl } = useT();
  const campus = useSelectedCampus();
  const week = THIS_WEEK_WEEKS[useThisWeekStore((s) => s.weekId)];
  const feed = toThisWeekFeed(week.items, campus, week.now);
  return {
    title: t('thisWeek.title'),
    isEmpty: feed.kind === 'empty',
    sections: toSectionTexts(feed, t, tpl),
    onOpenRow: openThisWeekNotice,
    onOpenNotices: openNoticesTab,
  };
}
