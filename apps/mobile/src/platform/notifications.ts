import { Platform } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { getBadgeCountAsync, setBadgeCountAsync } from 'expo-notifications';

export {
  AndroidImportance,
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  deleteNotificationChannelAsync,
  getLastNotificationResponse,
  getNotificationChannelAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationResponse,
} from 'expo-notifications';

/**
 * WHY: registered here, not in `messaging.ts`, and only at module scope in `index.ts`: that entry also
 * runs as Android's headless task, and `messaging.ts` pulls in `expo-web-browser` through `handoff.ts`.
 */
export function registerBackgroundMessageHandler(
  handler: Parameters<typeof setBackgroundMessageHandler>[1],
): void {
  setBackgroundMessageHandler(getMessaging(), handler);
}

/**
 * QUIRK(expo-notifications): on Android `setBadgeCountAsync(0)` calls `cancelAll()`, clearing the tray,
 * and the count lives in process memory, so the stored unread count is mirrored onto the iOS icon only.
 */
export async function incrementOsBadge(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await setBadgeCountAsync((await getBadgeCountAsync()) + 1);
  } catch (e) {
    if (__DEV__) console.warn('[badge] increment failed:', e);
  }
}

export async function clearOsBadge(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await setBadgeCountAsync(0);
  } catch (e) {
    if (__DEV__) console.warn('[badge] clear failed:', e);
  }
}
