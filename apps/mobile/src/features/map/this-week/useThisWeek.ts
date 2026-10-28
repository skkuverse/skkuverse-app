import { formatKstDate, useT } from '@skkuverse/shared';
import { useMapLayout } from '../useMapLayout';
import { useSelectedCampus } from '../useSelectedCampus';
import { THIS_WEEK_WEEK_IDS, THIS_WEEK_WEEKS } from './this-week.constants';
import { toSectionTexts, toSheetFeed, toThisWeekFeed } from './this-week.rules';
import { openNoticesTab, openThisWeekNotice, openThisWeekPage } from './this-week.service';
import { useThisWeekStore } from './this-week.store';

export function useThisWeek() {
  const { sheetContentBottom } = useMapLayout();
  const { t, tpl } = useT();
  const campus = useSelectedCampus();
  const weekId = useThisWeekStore((s) => s.weekId);
  const chooseWeek = useThisWeekStore((s) => s.chooseWeek);
  // WHY: the weeks are frozen, so their cut is the clock; the rules take it as `now`.
  const week = THIS_WEEK_WEEKS[weekId];
  const { feed, hasMore, moreCount } = toSheetFeed(toThisWeekFeed(week.items, campus, week.now));

  return {
    isEmpty: feed.kind === 'empty',
    sections: toSectionTexts(feed, t, tpl),
    hasMore,
    moreLabel: tpl('thisWeek.more', moreCount),
    bottomPadding: sheetContentBottom,
    weeks: __DEV__ ? THIS_WEEK_WEEK_IDS.map((id) => ({ id, label: formatKstDate(THIS_WEEK_WEEKS[id].now, t) })) : [],
    weekId,
    onWeek: chooseWeek,
    onMore: openThisWeekPage,
    onOpenRow: openThisWeekNotice,
    onOpenNotices: openNoticesTab,
  };
}
