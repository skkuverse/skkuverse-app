import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuthStore, useNotificationStore, useT } from '@skkuverse/shared';
import { requireNotificationSession, setCategoryEnabled } from './notifications.service';
import { logHandledError } from '@/platform/crashlytics';

export function useServicesSettings() {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const preferences = useNotificationStore((s) => s.preferences);

  const masterEnabled = preferences.enabled;
  const checked = preferences.categoryEnabled?.services ?? false;

  const handleToggle = useCallback(
    async (next: boolean) => {
      const session = requireNotificationSession();
      if ('reason' in session) {
        Alert.alert(t(session.messageKey));
        return;
      }
      try {
        await setCategoryEnabled(session.uid, 'services', next);
      } catch (err) {
        logHandledError('notifications/set-category', err);
      }
    },
    [t],
  );

  const authReady = !!uid && !isAnonymous;

  return { authReady, masterEnabled, checked, handleToggle };
}
