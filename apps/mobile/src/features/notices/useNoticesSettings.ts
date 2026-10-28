import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import type { SheetRef } from '@skkuverse/sds';
import { useAuthStore, useNotificationStore, useT } from '@skkuverse/shared';
import { requireSession } from '@/features/auth/auth.service';
import { setCategoryEnabled, setNoticeTabEnabled } from '@/features/notifications/notifications.service';
import { checkPermission } from '@/platform/messaging';
import { logHandledError } from '@/platform/crashlytics';
import { logNotificationTabToggle } from '@/platform/analytics';
import { useNoticeTabs } from './useNoticeTabs';

export function useNoticesSettings() {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const enableSheetDismissed = useNotificationStore(
    (s) => s.enableSheetDismissedThisSession,
  );

  // WHY: reads the OS status on focus, so a change made in the OS settings heals on return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void checkPermission().then((status) => {
        if (!cancelled) setPermissionStatus(status);
      });
      return () => {
        cancelled = true;
      };
    }, [setPermissionStatus]),
  );

  // WHY: the dismissal is session-scoped in the store, so closing the sheet once silences it on both screens.
  const enableSheetRef = useRef<SheetRef>(null);
  useEffect(() => {
    const notGranted =
      permissionStatus === 'denied' || permissionStatus === 'notDetermined';
    if (notGranted && !enableSheetDismissed) {
      enableSheetRef.current?.present?.();
    }
  }, [permissionStatus, enableSheetDismissed]);

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();

  const masterEnabled = preferences.enabled;
  const noticesEnabled = preferences.categoryEnabled?.notices === true;
  const togglesDisabled = !masterEnabled;

  const handleToggleCategory = useCallback(
    async (next: boolean) => {
      const session = requireSession();
      if ('reason' in session) {
        Alert.alert(t(session.messageKey));
        return;
      }
      try {
        await setCategoryEnabled(session.uid, 'notices', next);
      } catch (err) {
        logHandledError('notifications/set-category', err);
      }
    },
    [t],
  );

  const handleToggleNoticeTab = useCallback(
    async (tabKey: string, next: boolean) => {
      const session = requireSession();
      if ('reason' in session) {
        Alert.alert(t(session.messageKey));
        return;
      }
      logNotificationTabToggle({ tab_key: tabKey, enabled: next, source: 'settings' });
      try {
        await setNoticeTabEnabled(session.uid, tabKey, next);
      } catch (err) {
        logHandledError('notifications/set-notice-tab', err);
      }
    },
    [t],
  );

  // WHY: undefined is on, as the functions derive it.
  const isNoticeTabOn = useCallback(
    (key: string): boolean => preferences.noticeTabEnabled?.[key] !== false,
    [preferences.noticeTabEnabled],
  );

  const authReady = !!uid && !isAnonymous;

  return {
    authReady,
    enableSheetRef,
    masterEnabled,
    noticesEnabled,
    togglesDisabled,
    tabsConfig,
    tabsLoading,
    tabsError,
    refetchTabs,
    handleToggleCategory,
    handleToggleNoticeTab,
    isNoticeTabOn,
  };
}
