import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getLocales } from 'expo-localization';
import { useNotificationStore, useSettingsStore } from '@skkuverse/shared';
import { anonymousSession } from '@/features/auth/auth.service';
import { syncUserLocale } from '@/features/notifications/notifications.service';
import { setAppLanguage, setPreferredCampus, syncNotificationPermission, track } from '@/platform/analytics';
import { checkPermission } from '@/platform/messaging';
import { takeHandoff } from '@/platform/handoff';
import type { HandoffKind } from '@/platform/handoff.rules';
import { resolveAppLanguage, toNotificationLocale } from './language.rules';

export function useForegroundSync(): void {
  useEffect(() => {
    // QUIRK(ios): Control Center and the notification pull-down pass through 'inactive', which is not leaving the app.
    // QUIRK(android): the locale can change without a restart, and a permission dialog or share sheet backgrounds the app.
    let backgroundedAt = 0;
    let handoff: HandoffKind | undefined;
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'background') {
          backgroundedAt = Date.now();
          handoff = takeHandoff(backgroundedAt) ?? handoff;
        }
        if (state === 'active') {
          if (backgroundedAt > 0) {
            track('app_foreground', { bg_ms: Date.now() - backgroundedAt, handoff });
            backgroundedAt = 0;
            handoff = undefined;
          }
          anonymousSession.onForeground();
          void checkPermission().then(syncNotificationPermission);
          const lang = resolveAppLanguage(getLocales());
          useSettingsStore.getState().setAppLanguage(lang);
          setAppLanguage(lang);
        }
      },
    );

    // WHY: here rather than in the shared store, so packages/shared stays pure state and the app owns Firestore.
    const unsubLocale = useSettingsStore.subscribe((state, prev) => {
      if (state.preferredCampus !== prev.preferredCampus) setPreferredCampus(state.preferredCampus);
      if (state.appLanguage !== prev.appLanguage) syncUserLocale(toNotificationLocale(state.appLanguage));
    });

    // WHY: every permission request writes its answer here, so this runs right after each one.
    const unsubPermission = useNotificationStore.subscribe((state, prev) => {
      if (state.permissionStatus !== prev.permissionStatus) void checkPermission().then(syncNotificationPermission);
    });

    return () => {
      unsubLocale();
      unsubPermission();
      appStateSubscription.remove();
    };
  }, []);
}
