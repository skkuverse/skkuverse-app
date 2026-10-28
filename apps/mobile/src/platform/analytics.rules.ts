// WHY: import-free so it loads under `node --test` as is.

export type ParamValue = string | number | boolean | null | undefined;
export type Params = Readonly<Record<string, ParamValue>>;

export type SentParams = Record<string, string | number>;

/**
 * QUIRK(firebase): past 25 params (the default ones count), 40-character names, 100-character values or
 * a reserved prefix, GA4 drops the param or the event silently (support.google.com/analytics/answer/9267744).
 */
export const MAX_PARAMS = 25;
export const DEFAULT_PARAM_COUNT = 2;
export const MAX_VALUE_LENGTH = 100;

const PARAM_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const RESERVED_PREFIX = /^(firebase_|google_|ga_)/;

export const isParamName = (key: string) => PARAM_NAME.test(key) && !RESERVED_PREFIX.test(key);

/** WHY: a boolean goes as `'true'` or `'false'`, the form every existing GA4 report reads. */
export function sanitizeParams(params: Params): SentParams {
  const out: SentParams = {};
  let count = 0;
  for (const [key, value] of Object.entries(params)) {
    if (count >= MAX_PARAMS - DEFAULT_PARAM_COUNT) break;
    if (!isParamName(key) || value === null || value === undefined) continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value ? 'true' : 'false';
    } else {
      out[key] = value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;
    }
    count++;
  }
  return out;
}

export const MAX_FOREIGN_PARAMS = 10;
const FOREIGN_KEY = /^[a-z][a-z0-9_]{0,29}$/;

/** WHY: a page's own params go under `p_<key>`, so they can never overwrite the app's. */
export function foreignParams(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_FOREIGN_PARAMS) break;
    if (!FOREIGN_KEY.test(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    out[`p_${key}`] = value;
    count++;
  }
  return out;
}

const SRC = /^[a-z0-9_-]{1,32}$/;
export const campaignSrc = (value: unknown): string | undefined =>
  typeof value === 'string' && SRC.test(value) ? value : undefined;

/** WHY: one set for every view, so sources compare across features. SEE: docs/explanation/analytics.md */
const ENTRY_SOURCES = [
  'tab',
  'home_banner',
  'home_tile',
  'home_feed',
  'sdui',
  'deeplink',
  'push',
  'miniapp',
  'webview',
  'search',
  'list',
  'pin',
  'zone',
  'path',
  'chip',
  'place_sheet',
  'building_sheet',
  'line_sheet',
  'game',
  'hall_of_fame',
  'schedule_boarding',
  'schedule_transfer',
  'route_detail',
  'notice',
  'promo:transit_top',
  'promo:miniapp_games',
  'return',
  'other',
] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

/** WHY: a page pushed back by closing the place it opened is the same visit resumed, so it logs no open. */
export const isPageReturn = (source: unknown): boolean => source === 'return';

export const asEntrySource = (value: unknown): EntrySource =>
  (ENTRY_SOURCES as readonly unknown[]).includes(value) ? (value as EntrySource) : 'other';

export function withEntrySource(path: string, source: EntrySource): string {
  const hashAt = path.indexOf('#');
  const base = hashAt === -1 ? path : path.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : path.slice(hashAt);
  const queryAt = base.indexOf('?');
  if (queryAt !== -1 && /(?:^|&)source=/.test(base.slice(queryAt + 1))) return path;
  const joiner = queryAt === -1 ? '?' : base.endsWith('?') || base.endsWith('&') ? '' : '&';
  return `${base}${joiner}source=${source}${hash}`;
}

/** WHY: only a switch the app made carries a cause; a `tab_switch` without one is the user's own. */
export type TabSwitchCause = 'chip' | 'sheet' | 'promo';

export interface TabSwitchMark {
  tab: string;
  cause: TabSwitchCause;
  at: number;
}

/** WHY: a switch the navigation never made must not tag a later tap. */
export const TAB_SWITCH_MARK_MS = 2_000;

export function tabSwitchCause(mark: TabSwitchMark | null, tab: string, now: number): TabSwitchCause | undefined {
  return mark && mark.tab === tab && now - mark.at <= TAB_SWITCH_MARK_MS ? mark.cause : undefined;
}

/**
 * QUIRK(firebase): a sheet, modal or hosted page sends no `screen_view`, or GA4 counts the screen under
 * it as left. SEE: docs/explanation/analytics.md
 */
export type ViewName =
  | 'place_sheet'
  | 'building_sheet'
  | 'miniapp'
  | 'game'
  | 'miniapp_feed'
  | 'event_list'
  | 'leaderboard'
  | 'campus_routes'
  | 'campus_places'
  | 'transit_group'
  | 'line_sheet'
  | 'stop_sheet'
  | 'station_sheet'
  | 'transit_root';

/** SEE: docs/explanation/analytics.md */
export type ItemAction =
  | 'instagram'
  | 'link'
  | 'webview'
  | 'miniapp'
  | 'route'
  | 'external'
  | 'share'
  | 'map'
  | 'nav_back'
  | 'nav_forward'
  | 'menu'
  | 'refresh'
  | 'retry'
  | 'expand'
  | 'collapse'
  | 'expand_text'
  | 'gallery'
  | 'close'
  | 'direction'
  | 'stop'
  | 'accept'
  | 'dismiss'
  | 'prev'
  | 'next'
  | 'done'
  | 'swipe'
  | 'back'
  | 'return';

export type LinkKind = 'notice' | 'miniapp' | 'map_place' | 'transit_line' | 'static' | 'action' | 'blocked';

/**
 * QUIRK(android): the permission check there is `areNotificationsEnabled()` alone, so Android reports
 * only `granted` or `denied`, and a 13+ device never asked counts as `denied`.
 */
export type NotifPerm = 'granted' | 'provisional' | 'denied' | 'undetermined';

export function notifPermValue(
  status: 'authorized' | 'provisional' | 'denied' | 'notDetermined',
): NotifPerm {
  switch (status) {
    case 'authorized':
      return 'granted';
    case 'provisional':
      return 'provisional';
    case 'denied':
      return 'denied';
    case 'notDetermined':
      return 'undetermined';
  }
}

/** SEE: docs/decisions/0022-places-open-on-the-map-intents-start-in-transit.md ("Measuring it") */
export function firstSinceLaunch(launchedAt: number): (now: number) => number | undefined {
  let answered = false;
  return (now) => {
    if (answered) return undefined;
    answered = true;
    return Math.max(0, now - launchedAt);
  };
}
