import type { RemoteMessage } from '@react-native-firebase/messaging';
import { notificationStore } from '@skkuverse/shared';
import { incrementOsBadge } from '@/platform/notifications';

/**
 * QUIRK(firebase): the OS draws a notification+data payload in background and quit state, so drawing one here doubles it.
 * QUIRK(ios): this handler may be throttled; opening the notices tab reconciles the badge, covering a skipped increment.
 */
export async function backgroundMessageHandler(
  remoteMessage: RemoteMessage,
): Promise<void> {
  if (__DEV__) {
    console.log('[fcm] background message:', remoteMessage.messageId);
  }

  // WHY: a data-only message draws no banner the user could read to clear the badge; keyed on the block, not a type.
  if (!remoteMessage.notification) return;
  // WHY: only opening the notices tab clears the badge, and only a notice push leads there.
  if (remoteMessage.data?.type !== 'notice') return;

  await incrementOsBadge();
  notificationStore.getState().incrementUnread();
}
