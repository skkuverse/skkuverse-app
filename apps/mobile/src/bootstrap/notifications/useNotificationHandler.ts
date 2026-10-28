import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  incrementOsBadge,
  scheduleNotificationAsync,
} from '@/platform/notifications';
import { notificationStore } from '@skkuverse/shared';
import {
  getInitialNotification,
  onNotificationOpenedApp,
  onForegroundMessage,
} from '@/platform/messaging';
import {
  consumeNotificationResponse,
  navigateFromNotification,
  type NotificationData,
} from './notifications.service';
import { resolveNotificationChannel } from './notification-channels.rules';
import { devLog } from '@/platform/dev-log';
import { refreshMiniAppFeedOnPush } from '@/features/web/feed/feed.service';

// WHY: called inside RootLayout, after InitGate, so the router is available.
export function useNotificationHandler() {
  const initialHandled = useRef(false);

  useEffect(() => {
    if (!initialHandled.current) {
      initialHandled.current = true;
      getInitialNotification().then((message) => {
        // WHY: RELEASE-GATE(debug-menu) diagnostic for a cold-start tap; remove with the debug menu.
        devLog('getInitialNotification.resolve', {
          hasMessage: !!message,
          dataKeys: message?.data ? Object.keys(message.data) : null,
          dataType: typeof message?.data?.type === 'string' ? message.data.type : null,
        });
        if (message?.data) {
          const result = navigateFromNotification(message.data as NotificationData);
          devLog('getInitialNotification.navigate', { result });
        }
      });

      // QUIRK(react-native-firebase): a notification the app drew has no gcm.message_id, so getInitialNotification misses its tap.
      const lastResponse = getLastNotificationResponse();
      if (lastResponse) {
        devLog('expo.lastResponse', {
          dataKeys: Object.keys(lastResponse.notification.request.content.data ?? {}),
        });
        const data = consumeNotificationResponse(lastResponse);
        if (data) {
          const result = navigateFromNotification(data);
          devLog('expo.lastResponse.navigate', { result });
        }
      }
    }

    const unsubscribeOpened = onNotificationOpenedApp((message) => {
      // WHY: RELEASE-GATE(debug-menu) diagnostic for a warm tap; remove with the debug menu.
      devLog('onNotificationOpenedApp', {
        dataKeys: message.data ? Object.keys(message.data) : null,
        dataType: typeof message.data?.type === 'string' ? message.data.type : null,
      });
      if (message.data) {
        const result = navigateFromNotification(message.data as NotificationData);
        devLog('onNotificationOpenedApp.navigate', { result });
      }
    });

    const unsubscribeForeground = onForegroundMessage(async (message) => {
      // WHY: RELEASE-GATE(debug-menu) diagnostic for a foreground arrival; remove with the debug menu.
      devLog('onForegroundMessage', {
        messageId: message.messageId,
        dataKeys: message.data ? Object.keys(message.data) : null,
        hasNotification: !!message.notification,
      });

      const { notification, data } = message;

      refreshMiniAppFeedOnPush(data as Record<string, unknown> | undefined);

      if (!notification) return;

      // QUIRK(react-native-firebase): on iOS willPresent goes to expo-notifications' handler, which shows the banner;
      // FCM draws nothing in the Android foreground, so only Android draws a copy here.
      if (Platform.OS === 'android') {
        try {
          await scheduleNotificationAsync({
            content: {
              title: notification.title,
              body: notification.body,
              data: data ?? {},
            },
            // QUIRK(expo-notifications): `trigger: null` files it under expo's fallback channel, not the user's category.
            trigger: { channelId: resolveNotificationChannel(data) },
          });
        } catch (e) {
          if (__DEV__) console.warn('[notifications] scheduleNotificationAsync failed:', e);
        }
      }

      // WHY: only opening the notices tab clears the badge, so only a notice push may raise it.
      if (data?.type !== 'notice') return;

      await incrementOsBadge();
      notificationStore.getState().incrementUnread();
    });

    // QUIRK(react-native-firebase): onNotificationOpenedApp never fires for a notification the app drew itself.
    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      devLog('expo.response', {
        dataKeys: Object.keys(response.notification.request.content.data ?? {}),
      });
      const data = consumeNotificationResponse(response);
      if (!data) return;
      const result = navigateFromNotification(data);
      devLog('expo.response.navigate', { result });
    });

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
      responseSubscription.remove();
    };
  }, []);
}
