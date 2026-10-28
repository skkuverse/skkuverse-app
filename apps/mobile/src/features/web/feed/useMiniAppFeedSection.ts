import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useNotificationStore, useSettingsStore, useT } from '@skkuverse/shared';
import { useMiniAppPush } from '@/features/notifications/useMiniAppPush';
import { useClock, useNow } from '@/platform/clock';
import { handleSduiAction } from '@/features/web/web.service';
import { logHomeContentSelect } from '@/platform/analytics';
import { hasMiniAppPush } from '@/features/notifications/notifications.constants';
import { useFocusedMiniAppFeed } from './components/useFocusedMiniAppFeed';
import { FEED_HOME_REFETCH_MS, FEED_LABEL_TICK_MS, toFeedRoute } from './feed.constants';
import { decideFeedCard, toFeedSectionTitle, toFreshEdge } from './feed.rules';
import type { MiniAppFeedSectionCard } from './feed.types';

export function useMiniAppFeedSection({ miniAppId, title }: { miniAppId: string; title?: string }): {
  title: string;
  card: MiniAppFeedSectionCard;
  pushNotice: string | null;
  openList: () => void;
  onPressCard: () => void;
  onCloseNotice: () => void;
} {
  const router = useRouter();
  const { t, tpl } = useT();
  const { data } = useFocusedMiniAppFeed(miniAppId, { refetchMs: FEED_HOME_REFETCH_MS, refetchOnRefocus: true });
  const now = useNow(FEED_LABEL_TICK_MS);

  const push = useMiniAppPush(miniAppId);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const optedInHere = useSettingsStore((s) => s.miniAppOptIns.includes(miniAppId));

  const latest = data?.[0];
  const sentAt = latest?.sentAt;
  // WHY: home can stay open past the window, so the glow switches off at its
  // exact end, and back on when a refetch brings a newer sentAt.
  const freshEdge = useCallback((at: number) => toFreshEdge(sentAt, at), [sentAt]);
  const freshNow = useClock(freshEdge);

  const heading = toFeedSectionTitle(miniAppId, title, t);
  const card = decideFeedCard({
    miniAppId,
    title: heading,
    miniAppSendsPush: hasMiniAppPush(miniAppId, now),
    deviceReceivesPush: push.isOn,
    permissionStatus,
    optedInHere,
    latest,
    now,
    freshNow,
    t,
    tpl,
  });

  const openList = () => {
    logHomeContentSelect({ content_type: 'feed_more', item_id: miniAppId });
    router.push(toFeedRoute(miniAppId) as never);
  };

  const onPressCard = () => {
    switch (card.kind) {
      case 'askPush':
        logHomeContentSelect({ content_type: 'feed_push_ask', item_id: miniAppId });
        push.turnOn('feed');
        return;
      case 'empty':
        openList();
        return;
      case 'latest': {
        const { action } = card;
        if (action.kind === 'list') {
          openList();
          return;
        }
        logHomeContentSelect({ content_type: 'feed_row', item_id: card.entryId });
        handleSduiAction({ actionType: action.actionType, actionValue: action.actionValue, source: 'home_feed' });
      }
    }
  };

  return {
    title: heading,
    card,
    pushNotice: push.notice,
    openList,
    onPressCard,
    onCloseNotice: push.clearNotice,
  };
}
