import { useMemo } from 'react';
import { useT } from '@skkuverse/shared';
import { useNow } from '@/platform/clock';
import { handleSduiAction } from '@/features/web/web.service';
import { track } from '@/platform/analytics';
import { useMiniAppIndex } from '../useMiniAppIndex';
import { useFocusedMiniAppFeed } from './components/useFocusedMiniAppFeed';
import { FEED_LABEL_TICK_MS, FEED_SCREEN_REFETCH_MS } from './feed.constants';
import { toFeedItemAction, toFeedScreenRows, toFeedScreenTitle } from './feed.rules';
import type { MiniAppFeedOpenAction, MiniAppFeedPressableRow } from './feed.types';

function openEntry(entryId: string, { actionType, actionValue }: MiniAppFeedOpenAction): void {
  track('item_action', {
    view: 'miniapp_feed',
    item_id: entryId,
    action: toFeedItemAction(actionType),
    target: actionValue,
  });
  handleSduiAction({ actionType, actionValue, source: 'list' });
}

export function useMiniAppFeed(miniAppId: string): {
  status: 'loading' | 'error' | 'ready';
  title: string;
  rows: MiniAppFeedPressableRow[];
  refreshing: boolean;
  onRefresh: () => void;
} {
  const { t, tpl } = useT();
  const { data: index } = useMiniAppIndex();
  const { data, isLoading, isError, isRefetching, refetch } = useFocusedMiniAppFeed(miniAppId, {
    refetchMs: FEED_SCREEN_REFETCH_MS,
    refetchOnRefocus: false,
  });
  const now = useNow(FEED_LABEL_TICK_MS);

  const rows = useMemo(
    () =>
      toFeedScreenRows(data ?? [], { miniAppId, now, t, tpl }).map(
        ({ entry, timeText, action }): MiniAppFeedPressableRow => ({
          entry,
          timeText,
          onPress: action ? () => openEntry(entry.id, action) : undefined,
        }),
      ),
    [data, miniAppId, now, t, tpl],
  );

  return {
    status: isLoading ? 'loading' : isError ? 'error' : 'ready',
    title: toFeedScreenTitle(miniAppId, index, t),
    rows,
    refreshing: isRefetching,
    onRefresh: () => void refetch(),
  };
}
