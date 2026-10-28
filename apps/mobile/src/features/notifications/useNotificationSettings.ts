import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import type { SheetRef } from '@skkuverse/sds';
import { useAuthStore, useNotificationStore, useSettingsStore } from '@skkuverse/shared';
import { setMasterEnabled } from './notifications.service';
import { checkPermission } from '@/platform/messaging';
import { logHandledError } from '@/platform/crashlytics';

export function useNotificationSettings() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const enableSheetDismissed = useNotificationStore(
    (s) => s.enableSheetDismissedThisSession,
  );

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

  // WHY: settings has no master toggle, and the sheet turns it on only on a grant, so an account left at
  // `enabled: false` with permission granted gets no notifications; entry lifts it once (idempotent).
  useEffect(() => {
    if (!uid) return;
    if (preferences.enabled === false) {
      setMasterEnabled(uid, true).catch((err) => {
        logHandledError('notifications/auto-restore-master', err);
      });
    }
  }, [uid, preferences.enabled]);

  // WHY: depends on `permissionStatus`, so a permission revoked outside the app shows the sheet on the next
  // focus check; present() is idempotent.
  const enableSheetRef = useRef<SheetRef>(null);
  useEffect(() => {
    const notGranted =
      permissionStatus === 'denied' || permissionStatus === 'notDetermined';
    if (notGranted && !enableSheetDismissed) {
      enableSheetRef.current?.present?.();
    }
  }, [permissionStatus, enableSheetDismissed]);

  const authReady = !!uid && !isAnonymous;

  return { appLanguage, authReady, enableSheetRef };
}
