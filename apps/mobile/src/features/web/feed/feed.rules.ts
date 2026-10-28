import {
  parseActionType,
  parseMiniAppTarget,
  toBrowserUrl,
  type ActionType,
  type PushPermissionStatus,
  type TranslationKey,
} from '@skkuverse/shared';
import type { MiniAppFeedEntry, MiniAppIndexEntry } from '../web.types';
import { isGameId } from '@/features/games/games.constants';
import { FEED_REFOCUS_FRESH_MS, FRESH_WINDOW_MS, toFeedRoute } from './feed.constants';
import type {
  MiniAppFeedAction,
  MiniAppFeedAge,
  MiniAppFeedPush,
  MiniAppFeedScreenRow,
  MiniAppFeedSectionCard,
} from './feed.types';

type Translate = (key: TranslationKey) => string;
type Template = (key: TranslationKey, ...args: (string | number)[]) => string;

/** WHY: elapsed time, not a clock time: an entry is read minutes after it lands. A day or more shows the KST date. */
export function toFeedAge(sentAtIso: string, nowMs: number): MiniAppFeedAge {
  const sentMs = Date.parse(sentAtIso);
  const elapsed = nowMs - sentMs;
  // WHY: a slightly fast server clock gives a small negative elapsed, which is still "just now".
  if (elapsed < 60_000) return { kind: 'justNow' };
  if (elapsed < 3_600_000) return { kind: 'minutes', value: Math.floor(elapsed / 60_000) };
  if (elapsed < 86_400_000) return { kind: 'hours', value: Math.floor(elapsed / 3_600_000) };
  const kst = new Date(sentMs + 9 * 3_600_000);
  return { kind: 'date', month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}

export function toFeedAgeText(sentAtIso: string, nowMs: number, t: Translate, tpl: Template): string {
  const age = toFeedAge(sentAtIso, nowMs);
  switch (age.kind) {
    case 'justNow':
      return t('miniappFeed.justNow');
    case 'minutes':
      return tpl('miniappFeed.minutesAgo', String(age.value));
    case 'hours':
      return tpl('miniappFeed.hoursAgo', String(age.value));
    default:
      return `${age.month}/${age.day}`;
  }
}

/** WHY: a server clock running ahead adds its lead, never a negative age. */
export function toFreshRemainingMs(sentAtIso: string, nowMs: number, windowMs: number = FRESH_WINDOW_MS): number {
  const sentMs = Date.parse(sentAtIso);
  if (!Number.isFinite(sentMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, sentMs + windowMs - nowMs);
}

export function isFreshEntry(sentAtIso: string, nowMs: number, windowMs: number = FRESH_WINDOW_MS): boolean {
  return toFreshRemainingMs(sentAtIso, nowMs, windowMs) > 0;
}

export function toFreshEdge(sentAtIso: string | undefined, nowMs: number): number | null {
  const left = sentAtIso === undefined ? 0 : toFreshRemainingMs(sentAtIso, nowMs);
  return left > 0 ? nowMs + left : null;
}

export function isFeedRefetchDue(updatedAtMs: number, nowMs: number): boolean {
  return nowMs - updatedAtMs > FEED_REFOCUS_FRESH_MS;
}

/** SEE: docs/reference/miniapp-notification-payload.md */
export function toFeedPush(data: Record<string, unknown> | undefined): MiniAppFeedPush | null {
  if (data?.type !== 'miniapp' || typeof data.miniAppId !== 'string' || !data.miniAppId) return null;
  const entryId = typeof data.notificationId === 'string' && data.notificationId ? data.notificationId : null;
  return { miniAppId: data.miniAppId, entryId };
}

export function hasFeedEntry(entries: readonly MiniAppFeedEntry[] | undefined, entryId: string): boolean {
  return entries?.some((entry) => entry.id === entryId) ?? false;
}

// WHY: one table for the feeds the app names itself, so home's heading and the screen's title agree.
const APP_NAMED_FEED_TITLES: Readonly<Record<string, TranslationKey>> = {
  'eskara-2026': 'eskaraPush.feedTitle',
};

function toAppNamedFeedTitle(miniAppId: string, t: Translate): string | undefined {
  const key = Object.hasOwn(APP_NAMED_FEED_TITLES, miniAppId) ? APP_NAMED_FEED_TITLES[miniAppId] : undefined;
  return key ? t(key) : undefined;
}

export function toFeedSectionTitle(miniAppId: string, sectionTitle: string | undefined, t: Translate): string {
  return toAppNamedFeedTitle(miniAppId, t) ?? sectionTitle ?? t('miniappFeed.title');
}

export function toFeedScreenTitle(
  miniAppId: string,
  index: readonly MiniAppIndexEntry[] | undefined,
  t: Translate,
): string {
  const named = toAppNamedFeedTitle(miniAppId, t);
  if (named) return named;
  const entry = index?.find((e) => e.id === miniAppId);
  const appName = entry?.shortName ?? entry?.name;
  return appName ? `${appName} ${t('miniappFeed.title')}` : t('miniappFeed.title');
}

// WHY: a shape check only, not the push route allowlist: stored rows are the app's own feed, trusted
// as a stored webview action is, and they open `/mini-app?id=…` (D3).
const UNSAFE_ROUTE_RE = /\/\/|\\|[\s\u0000-\u001f\u007f]/;

function isWellShapedValue(actionType: Exclude<ActionType, 'unknown'>, value: string): boolean {
  if (actionType === 'route') return value.startsWith('/') && !UNSAFE_ROUTE_RE.test(value);
  if (actionType === 'webview' || actionType === 'external') return toBrowserUrl(value) !== null;
  // WHY: openMiniAppById opens a game id as the game, and a feed row, like a push, never opens one.
  if (actionType === 'miniapp') return !isGameId(parseMiniAppTarget(value)?.id ?? '');
  return true;
}

/**
 * WHY: an action this build cannot perform, a malformed value or one pointing at the feed itself falls back to the
 * list.
 */
export function decideEntryAction(entry: MiniAppFeedEntry, miniAppId: string): MiniAppFeedAction {
  if (!entry.actionType || !entry.actionValue) return { kind: 'list' };
  if (entry.actionType === 'route' && entry.actionValue === toFeedRoute(miniAppId)) return { kind: 'list' };
  const actionType = parseActionType(entry.actionType);
  if (actionType === 'unknown' || !isWellShapedValue(actionType, entry.actionValue)) return { kind: 'list' };
  return { kind: 'action', actionType, actionValue: entry.actionValue };
}

export interface ToFeedScreenRowsInputs {
  miniAppId: string;
  now: number;
  t: Translate;
  tpl: Template;
}

export function toFeedScreenRows(
  entries: readonly MiniAppFeedEntry[],
  { miniAppId, now, t, tpl }: ToFeedScreenRowsInputs,
): MiniAppFeedScreenRow[] {
  return entries.map((entry) => {
    const action = decideEntryAction(entry, miniAppId);
    return {
      entry,
      timeText: toFeedAgeText(entry.sentAt, now, t, tpl),
      action: action.kind === 'action' ? action : null,
    };
  });
}

export function toFeedItemAction(actionType: Exclude<ActionType, 'unknown'>): 'miniapp' | 'route' | 'link' {
  if (actionType === 'miniapp' || actionType === 'route') return actionType;
  return 'link';
}

export interface DecideFeedCardInputs {
  miniAppId: string;
  title: string;
  miniAppSendsPush: boolean;
  deviceReceivesPush: boolean;
  permissionStatus: PushPermissionStatus;
  /** WHY: the subscription made here, before the preferences document confirms it. */
  optedInHere: boolean;
  latest: MiniAppFeedEntry | undefined;
  /** WHY: the age label and the glow tick apart; this one words the label. */
  now: number;
  /** WHY: moves only at the glow's edge, so the card re-renders when the glow switches. */
  freshNow: number;
  t: Translate;
  tpl: Template;
}

export function decideFeedCard(inputs: DecideFeedCardInputs): MiniAppFeedSectionCard {
  const { miniAppId, title, miniAppSendsPush, deviceReceivesPush, permissionStatus, optedInHere, latest } = inputs;
  const { now, freshNow, t, tpl } = inputs;
  const granted = permissionStatus === 'authorized' || permissionStatus === 'provisional';
  // WHY: the local opt-in counts, so a device that subscribed here does not flash the ask while preferences load.
  if (miniAppSendsPush && !(deviceReceivesPush || (granted && optedInHere))) {
    const askTitle = t(granted ? 'miniappFeed.enableTitle' : 'miniappFeed.allowTitle');
    return { kind: 'askPush', title: askTitle, body: t('miniappFeed.allowBody'), a11yLabel: `${title}. ${askTitle}` };
  }
  if (!latest) {
    const body = t('miniappFeed.empty');
    return { kind: 'empty', body, a11yLabel: `${title}. ${body}` };
  }
  return {
    kind: 'latest',
    entryId: latest.id,
    title: latest.title,
    body: `${toFeedAgeText(latest.sentAt, now, t, tpl)} · ${latest.body}`,
    a11yLabel: `${title}. ${latest.title}. ${latest.body}`,
    fresh: isFreshEntry(latest.sentAt, freshNow),
    action: decideEntryAction(latest, miniAppId),
  };
}
