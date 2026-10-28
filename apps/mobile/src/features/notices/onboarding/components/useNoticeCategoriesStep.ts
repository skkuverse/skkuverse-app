import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNotificationStore, useT } from '@skkuverse/shared';
import { requireSession } from '@/features/auth/auth.service';
import { setNoticeTabEnabled } from '@/features/notifications/notifications.service';
import { logHandledError } from '@/platform/crashlytics';
import { logNotificationTabToggle } from '@/platform/analytics';
import { useNoticeTabs } from '../../useNoticeTabs';

export function useNoticeCategoriesStep() {
  const { t } = useT();
  const preferences = useNotificationStore((s) => s.preferences);

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

  const handleToggle = useCallback(
    async (tabKey: string, next: boolean) => {
      const session = requireSession();
      if ('reason' in session) {
        Alert.alert(t(session.messageKey));
        return;
      }
      logNotificationTabToggle({ tab_key: tabKey, enabled: next, source: 'onboarding' });
      try {
        await setNoticeTabEnabled(session.uid, tabKey, next);
      } catch (err) {
        logHandledError('onboarding/set-notice-tab', err);
      }
    },
    [t],
  );

  const isOn = useCallback(
    (key: string) => preferences.noticeTabEnabled?.[key] !== false,
    [preferences.noticeTabEnabled],
  );

  return { tabsConfig, tabsLoading, tabsError, refetchTabs, handleToggle, isOn };
}
