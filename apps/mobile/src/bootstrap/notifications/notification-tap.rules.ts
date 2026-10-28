import {
  NAVIGABLE_ACTION_TYPES,
  gameIdForUrl,
  parseActionType,
  parseMapPlaceRef,
  parseMiniAppTarget,
  toBrowserUrl,
  type MapPlaceRef,
  type NavigableActionType,
} from '@skkuverse/shared';
import { isGameId } from '@/features/games/games.constants';
import { toFeedRoute } from '@/features/web/feed/feed.constants';
import { ALLOWED_PATHS, CHIP_ID_RE } from '../deep-links/deep-links.rules';

/**
 * SEE: docs/reference/miniapp-notification-payload.md, the wire contract. QUIRK(firebase): FCM v1 sends
 * every `data` value as a string. WHY: `notificationId` is absent; only the server uses it, to audit delivery.
 */
export interface NotificationTapData {
  type?: string;
  sourceId?: string;
  articleNo?: string;
  miniAppId?: string;
  actionType?: string;
  actionValue?: string;
  chipId?: string;
  placeId?: string;
}


export type NotificationTap =
  | { kind: 'notice'; sourceId: string; articleNo: string }
  | { kind: 'sdui-action'; actionType: NavigableActionType; actionValue: string }
  | { kind: 'miniapp'; id: string; path?: string }
  | { kind: 'map'; chipId: string | null; place: MapPlaceRef | null }
  | null;

const MAP_ROUTE = '/campus';

// WHY: each is checked alone and an invalid one dropped, as the server-side function drops it.
function mapTapOf(data: NotificationTapData): NotificationTap {
  const chip = asNonEmptyString(data.chipId);
  const chipId = chip !== null && CHIP_ID_RE.test(chip) ? chip : null;
  const place = parseMapPlaceRef(data.placeId);
  return chipId || place ? { kind: 'map', chipId, place } : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNavigable(raw: unknown): NavigableActionType | null {
  const parsed = parseActionType(raw);
  return (NAVIGABLE_ACTION_TYPES as readonly string[]).includes(parsed)
    ? (parsed as NavigableActionType)
    : null;
}

function isAcceptableValue(
  actionType: NavigableActionType,
  value: string,
  senderId: string | null,
  gameOrigins: Readonly<Record<string, string>>,
): boolean {
  if (actionType === 'route') {
    // QUIRK(expo-router): it opens `//evil.com` as https://evil.com, so a route matches exactly, never by prefix.
    return ALLOWED_PATHS.includes(value) || (senderId !== null && value === toFeedRoute(senderId));
  }
  // WHY: `openWebView` hands a non-web URL to `Linking.openURL` and opens a game origin as the game.
  if (!value.startsWith('https://') || /\s/.test(value)) return false;
  const url = toBrowserUrl(value);
  return url !== null && gameIdForUrl(url, gameOrigins) === null;
}

export function resolveNotificationTap(
  data: NotificationTapData | undefined,
  gameOrigins: Readonly<Record<string, string>>,
): NotificationTap {
  const type = asNonEmptyString(data?.type);
  if (!type || !data) return null;

  switch (type) {
    case 'notice': {
      const sourceId = asNonEmptyString(data.sourceId);
      const articleNo = asNonEmptyString(data.articleNo);
      if (!sourceId || !articleNo) return null;
      return { kind: 'notice', sourceId, articleNo };
    }

    case 'miniapp': {
      const id = asNonEmptyString(data.miniAppId);
      const actionType = asNavigable(data.actionType);
      const actionValue = asNonEmptyString(data.actionValue);
      if (actionType && actionValue && isAcceptableValue(actionType, actionValue, id, gameOrigins)) {
        const map = actionType === 'route' && actionValue === MAP_ROUTE ? mapTapOf(data) : null;
        return map ?? { kind: 'sdui-action', actionType, actionValue };
      }

      // WHY: another sender's game id is refused, since the consumer opens a game id as the game.
      if (id && parseActionType(data.actionType) === 'miniapp') {
        const target = parseMiniAppTarget(data.actionValue);
        if (target && (target.id === id || !isGameId(target.id))) {
          const { id: targetId, path } = target;
          return path ? { kind: 'miniapp', id: targetId, path } : { kind: 'miniapp', id: targetId };
        }
      }

      // WHY: anything else lands on the mini app by id rather than a dead tap; a registry-resolved id is never
      // an arbitrary string. SEE: docs/reference/miniapp-notification-payload.md
      return id ? { kind: 'miniapp', id } : null;
    }

    default:
      return null;
  }
}
