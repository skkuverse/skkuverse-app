import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuth } from '@react-native-firebase/auth';
import { useNotificationStore, useSettingsStore } from '@skkuverse/shared';
import {
  checkPermission,
  ensureRegistered,
  getDeviceToken,
  requestPermission,
  requestPermissionInteractive,
} from '@/platform/messaging';
import { openOsSettings } from '@/platform/handoff';
import { initializeFirestoreNotifications } from './device/device.service';
import { logHandledError } from '@/platform/crashlytics';

interface UseEnableNotificationsFlowOptions {
  onResolved: (outcome: { granted: boolean }) => void;
  /** WHY: onboarding passes none, since `seedOnboardingPreferences` already writes `enabled: true`. */
  additionalOnGranted?: () => Promise<void> | void;
}

export async function registerCurrentDeviceForNotifications(): Promise<void> {
  await ensureRegistered();
  const fcmToken = await getDeviceToken();
  if (!fcmToken) return;
  useNotificationStore.getState().setFcmToken(fcmToken);

  const deviceId = useNotificationStore.getState().deviceId;
  if (!deviceId) return;

  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  const appLang = useSettingsStore.getState().appLanguage;
  const osLocale: 'ko' | 'en' = appLang === 'ko' ? 'ko' : 'en';
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  await initializeFirestoreNotifications({
    uid,
    deviceId,
    token: fcmToken,
    platform,
    appVersion,
    osLocale,
  });
  useNotificationStore.getState().setIsTokenRegistered(true);
}

/**
 * QUIRK(ios): a denied permission never re-prompts, so `denied` opens the OS settings and the return to
 * the foreground re-checks; `sentToSettingsRef` keeps every other foreground return a no-op.
 */
export function useEnableNotificationsFlow({
  onResolved,
  additionalOnGranted,
}: UseEnableNotificationsFlowOptions) {
  const sentToSettingsRef = useRef(false);

  const onResolvedRef = useRef(onResolved);
  const additionalOnGrantedRef = useRef(additionalOnGranted);
  useEffect(() => {
    onResolvedRef.current = onResolved;
    additionalOnGrantedRef.current = additionalOnGranted;
  });

  const runGrantedSideEffects = useCallback(async () => {
    try {
      await registerCurrentDeviceForNotifications();
    } catch (err) {
      logHandledError('notifications/register', err);
    }
    const extra = additionalOnGrantedRef.current;
    if (extra) {
      try {
        await extra();
      } catch (err) {
        logHandledError('notifications/additional-on-granted', err);
      }
    }
  }, []);

  const handleEnable = useCallback(async () => {
    const prior = useNotificationStore.getState().permissionStatus;
    // QUIRK(android): ask even when the status reads denied. A device never asked reads denied on 13+ and
    // can still show the dialog; only a permanent denial answers without one (requestPermissionInteractive).
    if (Platform.OS === 'android') {
      const { status, settingsOnly } = await requestPermissionInteractive();
      useNotificationStore.getState().setPermissionStatus(status);
      const granted = status === 'authorized' || status === 'provisional';
      if (granted) {
        await runGrantedSideEffects();
        onResolvedRef.current({ granted });
        return;
      }
      // WHY: only when no dialog can appear, so a first refusal is not bounced into Settings.
      if (settingsOnly) {
        sentToSettingsRef.current = true;
        await openOsSettings();
        return;
      }
      onResolvedRef.current({ granted: false });
      return;
    }
    if (prior === 'denied') {
      sentToSettingsRef.current = true;
      await openOsSettings();
      return;
    }
    const status = await requestPermission();
    useNotificationStore.getState().setPermissionStatus(status);
    const granted = status === 'authorized' || status === 'provisional';
    if (granted) {
      await runGrantedSideEffects();
    }
    onResolvedRef.current({ granted });
  }, [runGrantedSideEffects]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active' || !sentToSettingsRef.current) return;
      sentToSettingsRef.current = false;
      // QUIRK(android): requestPermission() reports authorized whatever the user did in Settings.
      const status = Platform.OS === 'android' ? await checkPermission() : await requestPermission();
      useNotificationStore.getState().setPermissionStatus(status);
      const granted = status === 'authorized' || status === 'provisional';
      if (granted) {
        await runGrantedSideEffects();
      }
      onResolvedRef.current({ granted });
    });
    return () => sub.remove();
  }, [runGrantedSideEffects]);

  return { handleEnable };
}
