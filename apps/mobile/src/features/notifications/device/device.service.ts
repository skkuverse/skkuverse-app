import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, getFirestore, serverTimestamp, setDoc, updateDoc } from '@react-native-firebase/firestore';
import {
  useNotificationStore,
  useSettingsStore,
  type DeviceDocument,
  type PreferencesDocument,
  type UserDocument,
} from '@skkuverse/shared';
import { primeAppCheck } from '@/platform/app-check';
import { logHandledError } from '@/platform/crashlytics';
import { getOrCreateDeviceId } from '@/platform/device-id';
import { ensureRegistered, getDeviceToken, requestPermission } from '@/platform/messaging';
import { shouldQueryPermissionAtLaunch } from '../miniapp-push.rules';
import { activeMiniAppOptIns } from '../notifications.constants';
import {
  ensurePreferencesDoc,
  getPreferences,
  getUserDoc,
  retryForCurrentUid,
  updateUserLocale,
} from '../notifications.service';

const DEVICES = 'devices';

async function registerDevice(
  deviceId: string,
  data: DeviceDocument,
): Promise<void> {
  await primeAppCheck();
  // WHY: serverTimestamp() avoids client clock skew.
  await setDoc(
    doc(getFirestore(), DEVICES, deviceId),
    {
      ...data,
      lastActive: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * WHY: an aborted `signal` skips the write, which would queue behind the caller's next step (after sign-in,
 * the re-register) and undo it. `onIssued` fires once the native module's serial queue holds the write,
 * ahead of any later one.
 */
export async function unregisterDevice(
  deviceId: string,
  signal?: AbortSignal,
  onIssued?: () => void,
): Promise<void> {
  await primeAppCheck();
  if (signal?.aborted) return;
  const write = updateDoc(doc(getFirestore(), DEVICES, deviceId), { active: false });
  onIssued?.();
  await write;
}

interface BootstrapParams {
  uid: string;
  deviceId: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osLocale: 'ko' | 'en';
}

/**
 * WHY: seeds an intent-only default for a reinstall or an anonymous-to-Google move, where onboarding does
 * not run. The device's `subscribedTopics` and `notificationsEnabled` are query replicas the Cloud
 * Function keeps in sync.
 */
export async function initializeFirestoreNotifications(
  params: BootstrapParams,
): Promise<void> {
  const { uid, deviceId, token, platform, appVersion, osLocale } = params;

  const [userDoc, prefsDoc] = await Promise.all([
    getUserDoc(uid),
    getPreferences(uid),
  ]);

  const bootstrap: Promise<void>[] = [];
  if (userDoc?.locale !== osLocale) {
    bootstrap.push(updateUserLocale(uid, osLocale));
  }

  // WHY: a seed failure must not skip device registration, so it is rethrown after `registerDevice` for the retry.
  let prefsError: unknown = null;
  let finalPrefs: PreferencesDocument | null = prefsDoc;
  if (!prefsDoc) {
    try {
      finalPrefs = await ensurePreferencesDoc(uid);
    } catch (err) {
      prefsError = err;
    }
  }

  if (bootstrap.length > 0) {
    await Promise.all(bootstrap);
  }

  await registerDevice(deviceId, {
    uid,
    token,
    platform,
    appVersion,
    lastActive: new Date(), // WHY: registerDevice writes serverTimestamp()
    active: true,
    subscribedTopics: finalPrefs?.subscribedTopics ?? [],
    notificationsEnabled: finalPrefs?.enabled ?? false,
    locale: osLocale,
  });

  if (prefsError) throw prefsError;
}

function registerForCurrentUid(deviceId: string, token: string, osLocale: UserDocument['locale']): Promise<void> {
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  return retryForCurrentUid((uid) =>
    initializeFirestoreNotifications({
      uid,
      deviceId,
      token,
      platform,
      appVersion,
      osLocale,
    }),
  );
}

/** QUIRK(ios): a request while 'notDetermined' raises the system dialog, so a user who skipped the wizard step is never asked here. */
export async function registerPushAtLaunch(deviceId: string, osLocale: UserDocument['locale']): Promise<void> {
  const onboardingCompleted = useSettingsStore.getState().onboardingCompleted;
  const persistedStatus = useNotificationStore.getState().permissionStatus;
  const shouldQueryPermission = shouldQueryPermissionAtLaunch({
    onboardingCompleted,
    persistedStatus,
    optIns: activeMiniAppOptIns(useSettingsStore.getState().miniAppOptIns, Date.now()),
  });
  if (!shouldQueryPermission) return;

  const permStatus = await requestPermission();
  useNotificationStore.getState().setPermissionStatus(permStatus);
  if (permStatus !== 'authorized' && permStatus !== 'provisional') return;

  await ensureRegistered();
  const fcmToken = await getDeviceToken();
  if (__DEV__) console.log('[fcm] token:', fcmToken);
  useNotificationStore.getState().setFcmToken(fcmToken);
  if (!fcmToken) return;

  await registerForCurrentUid(deviceId, fcmToken, osLocale);
  useNotificationStore.getState().setIsTokenRegistered(true);
}

export function registerRefreshedToken(token: string, osLocale: UserDocument['locale']): void {
  if (__DEV__) console.log('[fcm] token refreshed:', token);
  useNotificationStore.getState().setFcmToken(token);

  const storedDeviceId = useNotificationStore.getState().deviceId;
  if (!storedDeviceId) return;

  registerForCurrentUid(storedDeviceId, token, osLocale)
    .then(() => useNotificationStore.getState().setIsTokenRegistered(true))
    .catch((err) => logHandledError('notifications/token-refresh', err));
}

/**
 * WHY: deviceId straight from getOrCreateDeviceId, since the auth listener can fire before setDeviceId runs. A null
 * fcmToken means no device doc to move yet; onTokenRefresh registers it under the then-current uid.
 */
export function moveDeviceToCurrentUid(osLocale: UserDocument['locale']): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const fcmToken = useNotificationStore.getState().fcmToken;
  if (!deviceId || !fcmToken) return Promise.resolve();
  return registerForCurrentUid(deviceId, fcmToken, osLocale).catch((err) =>
    logHandledError('notifications/auth-transition', err),
  );
}
