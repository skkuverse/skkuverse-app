import { PermissionsAndroid, Platform, TurboModuleRegistry, type TurboModule } from 'react-native';
import {
  AuthorizationStatus as FcmAuthorizationStatus,
  getAPNSToken,
  getInitialNotification as fcmGetInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp as fcmOnNotificationOpenedApp,
  onTokenRefresh as fcmOnTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission as fcmRequestPermission,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { markHandoff } from './handoff';

type AuthorizationStatus = 'notDetermined' | 'authorized' | 'denied' | 'provisional';

function mapAuthStatus(status: Awaited<ReturnType<typeof hasPermission>>): AuthorizationStatus {
  switch (status) {
    case FcmAuthorizationStatus.AUTHORIZED:
      return 'authorized';
    case FcmAuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case FcmAuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'notDetermined';
  }
}

/**
 * WHY: `firebase.json` turns iOS auto-registration off, so call this after `requestPermission()` grants
 * and before `getDeviceToken()`.
 */
export async function ensureRegistered(): Promise<void> {
  if (Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(getMessaging())) {
    try {
      await registerDeviceForRemoteMessages(getMessaging());
    } catch (e) {
      if (__DEV__) console.warn('[fcm] registerDeviceForRemoteMessages failed:', e);
    }
  }
}

/**
 * QUIRK(expo-notifications): on Android 13+ `getPermissionsAsync` reports a never-asked permission as
 * denied, which collapses the four states here, so permissions stay on RNFB and PermissionsAndroid.
 */
export async function checkPermission(): Promise<AuthorizationStatus> {
  try {
    const status = await hasPermission(getMessaging());
    return mapAuthStatus(status);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] hasPermission failed:', e);
    return 'notDetermined';
  }
}

/** QUIRK(ios): the dialog shows only the first time and the cached answer returns after, so every launch may call this. */
export async function requestPermission(): Promise<AuthorizationStatus> {
  try {
    const status = await fcmRequestPermission(getMessaging());
    return mapAuthStatus(status);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] requestPermission failed:', e);
    return 'denied';
  }
}

/**
 * QUIRK(react-native): the PermissionsAndroid JS wrapper reads `shouldShowRequestPermissionRationale`
 * only for its own alert and does not expose it, so the native module is read directly.
 */
const nativePermissions =
  Platform.OS === 'android'
    ? TurboModuleRegistry.get<
        TurboModule & { shouldShowRequestPermissionRationale(permission: string): Promise<boolean> }
      >('PermissionsAndroid')
    : null;

/**
 * QUIRK(react-native-firebase): on Android `requestPermission()` resolves AUTHORIZED without asking, so
 * 13+ asks through PermissionsAndroid, whose `never_ask_again` is the one reliable no-dialog signal.
 * WHY: a "turn on" tap after one denial goes to settings, though Android would ask once more.
 */
export async function requestPermissionInteractive(): Promise<{
  status: AuthorizationStatus;
  settingsOnly: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { status: await requestPermission(), settingsOnly: false };
  }
  try {
    let result: string | null = null;
    if (Number(Platform.Version) >= 33) {
      const deniedOnce =
        (await nativePermissions?.shouldShowRequestPermissionRationale(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        )) === true;
      if (deniedOnce) {
        const status = await checkPermission();
        const granted = status === 'authorized' || status === 'provisional';
        return granted ? { status, settingsOnly: false } : { status: 'denied', settingsOnly: true };
      }
      // WHY: the one notification dialog that backgrounds the app; iOS's leave it active.
      markHandoff('permission');
      result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const status = await checkPermission();
    const granted = status === 'authorized' || status === 'provisional';
    if (granted) return { status, settingsOnly: false };
    // WHY: `granted` here means switched off in system settings, and null means no runtime dialog exists.
    const settingsOnly = result === null || result === 'never_ask_again' || result === 'granted';
    return { status: 'denied', settingsOnly };
  } catch (e) {
    if (__DEV__) console.warn('[fcm] requestPermissionInteractive failed:', e);
    return { status: 'denied', settingsOnly: false };
  }
}

/**
 * QUIRK(ios): `registerDeviceForRemoteMessages()` resolves at once, but the APNs token arrives later,
 * up to about 2 s after a first registration.
 */
async function waitForAPNsToken(timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const token = await getAPNSToken(getMessaging());
      if (token) return token;
    } catch {
      // WHY: an error before the token arrives is expected; keep polling.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (__DEV__) console.warn('[fcm] APNs token not received within', timeoutMs, 'ms');
  return null;
}

export async function getDeviceToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const apnsToken = await waitForAPNsToken(5000);
      if (!apnsToken) {
        if (__DEV__) console.warn('[fcm] getDeviceToken: APNs token unavailable, skipping FCM token');
        return null;
      }
    }
    return await getToken(getMessaging());
  } catch (e) {
    if (__DEV__) console.warn('[fcm] getToken failed:', e);
    return null;
  }
}

export function readRawDeviceToken(): Promise<string> {
  return getToken(getMessaging());
}

/** WHY: the safety net for a `getDeviceToken()` that gave up on a late APNs token. */
export function onTokenRefresh(callback: (token: string) => void): () => void {
  return fcmOnTokenRefresh(getMessaging(), callback);
}

export function onForegroundMessage(
  callback: (message: RemoteMessage) => void,
): () => void {
  return onMessage(getMessaging(), callback);
}

export async function getInitialNotification(): Promise<RemoteMessage | null> {
  try {
    return await fcmGetInitialNotification(getMessaging());
  } catch (e) {
    if (__DEV__) console.warn('[fcm] getInitialNotification failed:', e);
    return null;
  }
}

export function onNotificationOpenedApp(
  callback: (message: RemoteMessage) => void,
): () => void {
  return fcmOnNotificationOpenedApp(getMessaging(), callback);
}
