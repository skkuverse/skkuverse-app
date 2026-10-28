import { Platform } from 'react-native';
import { router } from 'expo-router';
import {
  AndroidImportance,
  clearLastNotificationResponse,
  deleteNotificationChannelAsync,
  getNotificationChannelAsync,
  setNotificationChannelAsync,
  type NotificationResponse,
} from '@/platform/notifications';
import { createMMKV } from 'react-native-mmkv';
import { getGameOrigins } from '@skkuverse/shared';
import { NotificationChannelId } from './notification-channels.rules';
import { rememberHandled, shouldHandleResponse } from './notification-response.rules';
import {
  resolveNotificationTap,
  type NotificationTap,
  type NotificationTapData,
} from './notification-tap.rules';
import { pendingMapChipLink, pendingMapPlaceLink } from '@/features/map/map.service';
import { pendingExternalNoticeLink } from '@/features/notices/notices.service';
import { pendingMiniAppLink, pendingSduiAction } from '@/features/web/web.service';
import { track } from '@/platform/analytics';
import { devLog } from '@/platform/dev-log';

export type NotificationData = NotificationTapData;

// WHY: a breadcrumb, since a quit-state launch has no Metro console.
export function resolveTap(data: NotificationData | undefined): NotificationTap {
  devLog('notificationTap.resolve', {
    type: data?.type ?? null,
    keys: data ? Object.keys(data) : null,
  });
  return resolveNotificationTap(data, getGameOrigins());
}

/**
 * QUIRK(expo-router): a push before the root navigator has a key is silently lost, so every destination is stashed
 * for the consumers in app/_layout.tsx, which drain it once navigation is ready.
 */
export function applyTap(tap: NotificationTap): boolean {
  if (!tap) {
    devLog('notificationTap.exit', { result: false, reason: 'no-destination' });
    return false;
  }

  switch (tap.kind) {
    case 'notice':
      pendingExternalNoticeLink.set({
        sourceId: tap.sourceId,
        articleNo: tap.articleNo,
        source: 'push',
      });
      track('link_open', { kind: 'notice', via: 'push', item_id: `${tap.sourceId}/${tap.articleNo}` });
      break;

    case 'miniapp':
      pendingMiniAppLink.set(tap.path ? { id: tap.id, path: tap.path, via: 'push' } : { id: tap.id, via: 'push' });
      track('link_open', { kind: 'miniapp', via: 'push', item_id: tap.id });
      break;

    case 'sdui-action':
      pendingSduiAction.set({ actionType: tap.actionType, actionValue: tap.actionValue });
      track('link_open', { kind: 'action', via: 'push', item_id: tap.actionValue });
      break;

    case 'map': {
      // WHY: chip first, so the place opens over the chip's list.
      if (tap.chipId) pendingMapChipLink.set({ chipId: tap.chipId, source: 'push' });
      if (tap.place) pendingMapPlaceLink.set({ ...tap.place, source: 'push', tab: 'map' });
      const itemId = tap.place
        ? `${tap.place.kind ? `${tap.place.kind}:` : ''}${tap.place.placeId}`
        : `chip:${tap.chipId ?? ''}`;
      track('link_open', { kind: 'map_place', via: 'push', item_id: itemId });
      break;
    }
  }

  devLog('notificationTap.exit', { result: true, kind: tap.kind });
  return true;
}

// WHY: inside the React tree only; it activates a tab first, so backing out of the pushed screen lands on that tab.
// An sdui-action gets no tab: its destination is already a pushed screen or a route, and a tab would move where back lands.
export function navigateFromNotification(data: NotificationData | undefined): boolean {
  const tap = resolveTap(data);

  // WHY: navigate, not push, which would stack a second (tabs) entry when the user is already on that tab.
  if (tap?.kind === 'notice') {
    router.navigate('/(tabs)/notices');
  } else if (tap?.kind === 'miniapp') {
    router.navigate('/(tabs)/home');
  }
  // WHY: a map tap stashes before navigating, so a map tab already mounted takes the chip and place on this tap.
  if (tap?.kind === 'map') {
    const handled = applyTap(tap);
    router.navigate('/(tabs)/campus');
    return handled;
  }

  return applyTap(tap);
}

const HANDLED_KEY = 'handled_ids';
const mmkv = createMMKV({ id: 'notification-response' });

function readHandled(): string[] {
  try {
    const raw = mmkv.getString(HANDLED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// WHY: handled ids persist in MMKV, since the replay that matters most comes after a reload, which resets memory.
export function consumeNotificationResponse(
  response: NotificationResponse,
): NotificationData | null {
  const { identifier, trigger, content } = response.notification.request;
  const triggerType =
    trigger && 'type' in trigger && typeof trigger.type === 'string'
      ? trigger.type
      : undefined;

  const handled = readHandled();
  if (!shouldHandleResponse(triggerType, identifier, handled)) return null;

  mmkv.set(HANDLED_KEY, JSON.stringify(rememberHandled(handled, identifier)));
  clearLastNotificationResponse();
  return (content.data ?? {}) as NotificationData;
}

/**
 * QUIRK(android): an app can never raise an existing channel's importance or sound, so a behaviour change ships
 * under a new id, retired here and changed in the server-side functions too.
 */
const RETIRED_CHANNELS: readonly { from: string; to: string }[] = [
  { from: 'miniapp_general', to: NotificationChannelId.MINIAPP },
];

// QUIRK(expo-notifications): `sound: 'default'` logs an error, and a channel plays the system default anyway.
const CHANNELS = [
  { id: NotificationChannelId.ESSENTIAL, name: '필수 알림' },
  { id: NotificationChannelId.SERVICES, name: '다른 서비스' },
  { id: NotificationChannelId.ACADEMIC, name: '학사 공지' },
  { id: NotificationChannelId.SCHOLARSHIP, name: '장학 공지' },
  { id: NotificationChannelId.CAREER, name: '취업·모집' },
  { id: NotificationChannelId.GENERAL, name: '일반·행사' },
  { id: NotificationChannelId.DEPARTMENT, name: '학과 공지' },
  { id: NotificationChannelId.MINIAPP, name: '미니앱 알림' },
] as const;

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await retireChannels();
  } catch (e) {
    if (__DEV__) console.warn('[notifications] retireChannels failed:', e);
  }

  try {
    await Promise.all(
      CHANNELS.map((ch) =>
        setNotificationChannelAsync(ch.id, {
          name: ch.name,
          importance: AndroidImportance.HIGH,
        }),
      ),
    );
  } catch (e) {
    if (__DEV__) console.warn('[notifications] setNotificationChannelAsync failed:', e);
  }
}

// WHY: a user's "off" carries to the successor first, created at NONE, which the HIGH setup after cannot raise.
async function retireChannels(): Promise<void> {
  for (const { from, to } of RETIRED_CHANNELS) {
    const old = await getNotificationChannelAsync(from);
    if (!old) continue;
    // QUIRK(expo-notifications): a switched-off channel reads as NONE, which is 2 in expo's enum, 0 in Android's.
    if (old.importance === AndroidImportance.NONE) {
      const successor = CHANNELS.find((ch) => ch.id === to);
      if (successor) {
        await setNotificationChannelAsync(successor.id, {
          name: successor.name,
          importance: AndroidImportance.NONE,
        });
      }
    }
    await deleteNotificationChannelAsync(from);
  }
}
