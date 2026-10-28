import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { pendingExternalNoticeLink } from '@/features/notices/notices.service';
import { devLog } from '@/platform/dev-log';

// WHY: its own component, since useRootNavigationState re-renders on every nav change and would take RootLayout with it.
export function PendingNoticeLinkConsumer() {
  const navState = useRootNavigationState();

  useEffect(() => {
    // WHY: RELEASE-GATE(debug-menu) diagnostic, ordering the push against navState ready; remove with the debug menu.
    devLog('rootNavState.change', {
      hasKey: !!navState?.key,
      index: navState?.index,
      routeCount: navState?.routes?.length,
    });

    if (!navState?.key) return;

    const tryConsume = () => {
      const p = pendingExternalNoticeLink.consume();
      devLog('pendingLink.tryConsume', {
        navStateKey: !!navState?.key,
        hasPending: !!p,
      });
      if (!p) return;
      // QUIRK(react-native-screens): a same-tick push can be coalesced with the caller's /(tabs)/notices navigate.
      requestAnimationFrame(() => {
        router.push({
          pathname: '/notices/[sourceId]/[articleNo]',
          params: {
            sourceId: p.sourceId,
            articleNo: p.articleNo,
          },
        });
      });
    };

    tryConsume();
    return pendingExternalNoticeLink.subscribe(tryConsume);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the root navigator gets its key, not on every push
  }, [navState?.key]);

  return null;
}
