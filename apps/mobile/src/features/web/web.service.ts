// WHY: only an id and a path cross the route boundary, never a name or URL, and an arbitrary
// URL opens through openWebView below instead.
// SEE: docs/explanation/miniapp-shell.md
import { router } from 'expo-router';
import {
  gameIdForUrl,
  getGameOrigins,
  getMiniAppOrigins,
  miniAppTargetForUrl,
  parseIncomingLink,
  parseMapPlaceRef,
  parseMiniAppTarget,
  type ActionType,
  type MapPlaceRef,
  type MiniAppTarget,
  handsOffToOs,
  isInstagramUrl,
  queryClient,
} from '@skkuverse/shared';
import { isGameId, type GameId } from '@/features/games/games.constants';
import { resolveGameForOpen } from '@/features/games/games.service';
import { resolveWebAction } from './web-action.rules';
import type { PageOrigin } from '@/features/map/sheet-stack.types';
import { withEntrySource, type EntrySource } from '@/platform/analytics.rules';
import { logHandledError } from '@/platform/crashlytics';
import { devLog } from '@/platform/dev-log';
import { openExternalUrl } from '@/platform/handoff';
import { DECLARED_APP_PACKAGES, DECLARED_APP_SCHEMES } from '../../../config/external-apps';
import {
  decideMiniAppNavigation,
  decideNavigation,
  isOpenableUrl,
  schemeOf,
  type NavDecision,
  type NavRequest,
} from './navigation.rules';
import { miniAppDetailQueryOptions } from './web.client';
import { miniAppLinkQueue, unopenableGameSignal } from './web.store';
import { normalizeWebUrl } from './web-url.rules';

/** WHY: `origin` is the page asking, which the place's close returns to. */
export type MapPlaceOpener = (ref: MapPlaceRef, source?: EntrySource, origin?: PageOrigin) => void;

// WHY: the SDUI `map` arm opens a map place, but map's components import this file, so web
// importing map would make the two features a cycle; bootstrap registers map's opener at load.
// WHY: reported in a release build too, since only an entry that skips the root layout reaches it.
let mapPlaceOpener: MapPlaceOpener = (ref) => {
  if (__DEV__) console.warn('[sdui] map action before a map place opener was registered:', ref);
  logHandledError('web/map-opener-missing', new Error(`map action before the opener was registered: ${ref.placeId}`));
};

export function registerMapPlaceOpener(opener: MapPlaceOpener): void {
  mapPlaceOpener = opener;
}

/**
 * WHY: for a feature holding a place reference rather than an SDUI action; the page named as `origin` gets it back
 * on close.
 */
export function openMapPlace(ref: MapPlaceRef, source?: EntrySource, origin?: PageOrigin): void {
  mapPlaceOpener(ref, source, origin);
}

export { miniAppLinkQueue as pendingMiniAppLink, sduiActionQueue as pendingSduiAction } from './web.store';

export const unopenableGameTap = {
  subscribe: (cb: () => void) => unopenableGameSignal.subscribe(cb),
};

/**
 * WHY: a deep link or push tap has already put the user on home (`home`); an in-app tap leaves them
 * where they are (`stay`) with a toast, so a dead game never yanks them out of their stack.
 */
type WhenUnopenable = 'home' | 'stay';

// WHY: how long an id stays claimed after its screen was pushed. A second tap in the frames
// before the modal covers the tile would push a second screen; past this it is covered.
const OPEN_SETTLE_MS = 800;

const opening = new Set<GameId>();

export function resetGameOpens(): void {
  opening.clear();
}

/**
 * WHY: a second open of an id in flight (a double tap, a tap during a cold-start resolution) is dropped,
 * so one tap opens one screen. Only the id and `source` cross the route; the screen re-reads the page.
 */
async function openGame(
  id: GameId,
  source: EntrySource,
  whenUnopenable: WhenUnopenable,
  stillWanted: () => boolean = () => true,
): Promise<void> {
  if (opening.has(id)) {
    devLog('game.open.dropped', { id, why: 'in flight' });
    return;
  }
  opening.add(id);
  let pushed = false;
  try {
    const { exposure, page } = await resolveGameForOpen(id);
    if (!stillWanted()) return;
    if (page === null) {
      devLog('game.unopenable', { id, why: exposure.kind === 'hosted' ? 'off-origin' : exposure.kind, whenUnopenable });
      if (whenUnopenable === 'home') router.dismissTo('/(tabs)/home' as never);
      else unopenableGameSignal.raise();
      return;
    }
    router.push({ pathname: '/games/[id]', params: { id, source } } as never);
    pushed = true;
  } finally {
    if (pushed) setTimeout(() => opening.delete(id), OPEN_SETTLE_MS);
    else opening.delete(id);
  }
}

// WHY: openGame resolves the registry and navigates; anything it throws (a router call before the
// navigation root is ready, an unexpected resolve error) would otherwise be an unhandled rejection.
const logOpenFailure = (e: unknown): void => logHandledError('games/open', e);

/** WHY: every caller is an in-app tap, so a game that does not open leaves the user where they are. */
export function openMiniAppById(id: string, path?: string, source: EntrySource = 'other'): void {
  // WHY: games first, then mini apps (docs/explanation/in-app-games.md, Opening a game).
  if (isGameId(id)) {
    openGame(id, source, 'stay').catch(logOpenFailure);
    return;
  }
  router.push({
    pathname: '/mini-app',
    params: path ? { id, path, source } : { id, source },
  } as never);
}

export function openMiniAppTarget(target: MiniAppTarget, source?: EntrySource): void {
  openMiniAppById(target.id, target.path, source);
}

const HOME_PATH = '/home';

/**
 * WHY: a link that resolves after the user went elsewhere is dropped, never pushed over a screen they chose; a warm
 * push tap's home navigate may not have reached the pathname yet.
 */
function linkStillWanted(atConsume: string, now: string): boolean {
  return now === HOME_PATH || now === atConsume;
}

export function openPendingMiniAppLink(currentPath: () => string): void {
  const link = miniAppLinkQueue.consume();
  if (!link) return;
  const atConsume = currentPath();
  const stillWanted = (): boolean => {
    const now = currentPath();
    if (linkStillWanted(atConsume, now)) return true;
    devLog('pendingMiniApp.left', { id: link.id, at: now });
    return false;
  };
  // WHY: a game waits for the games registry, not a mini-app detail; one that does not open
  // lands on home, where the link already put the user.
  if (isGameId(link.id)) {
    const { id } = link;
    requestAnimationFrame(() => {
      openGame(id, link.via ?? 'deeplink', 'home', stillWanted).catch(logOpenFailure);
    });
    return;
  }
  const options = miniAppDetailQueryOptions(link.id);
  // WHY: staleTime 0 fetches over a cached detail too, since the shell pins the first startUrl.
  void queryClient
    .query({ ...options, staleTime: 0 })
    .catch((error: unknown) => {
      // WHY: a failed query keeps the copy cachedQueryOptions seeded, so a link still opens offline.
      if (queryClient.getQueryData(options.queryKey) === undefined) throw error;
    })
    .then(() => {
      // QUIRK(rnscreens): a push in the same frame as the home navigate is coalesced away.
      requestAnimationFrame(() => {
        if (stillWanted()) openMiniAppById(link.id, link.path, link.via ?? 'deeplink');
      });
    })
    // WHY: dropped silently; the user is already on home, and an error screen would let a
    // stranger's link plant a dead end.
    .catch(() => {
      devLog('pendingMiniApp.unresolved', { id: link.id });
    });
}

const DECLARED_APPS = { schemes: DECLARED_APP_SCHEMES, packages: DECLARED_APP_PACKAGES };

export interface OpenWebViewParams {
  url: string;
  title?: string;
  source?: EntrySource;
}

/** WHY: an Instagram address leaves too; the place sheet asks so it stays up for the app switch. */
export function leavesApp(url: string): boolean {
  const { url: normalized, isWeb } = normalizeWebUrl(url);
  return !isWeb || isInstagramUrl(normalized);
}

// WHY: a game or mini-app origin opens its own screen, since in /webview its SDK finds no bridge. No helper
// blurs this and `openMiniApp`; one put notice pages inside the shell. Grants: capabilities.rules.ts.
export function openWebView({ url, title, source }: OpenWebViewParams): void {
  const { url: normalized, isWeb } = normalizeWebUrl(url);
  if (leavesApp(url)) {
    void openExternalUrl(isWeb ? normalized : (url ?? '').trim()).catch(() => {});
    return;
  }
  // WHY: games first, then mini apps (design D5); a game origin is in neither mini-app list, and a
  // game page in /webview or the shell would find no host and get no game grants.
  const gameId = gameIdForUrl(normalized, getGameOrigins());
  if (gameId !== null) {
    // WHY: an in-app tap, so a game that does not open leaves the page on screen.
    if (isGameId(gameId)) openGame(gameId, source ?? 'other', 'stay').catch(logOpenFailure);
    else {
      devLog('game.unopenable', { id: gameId, why: 'no first-party config', whenUnopenable: 'stay' });
      unopenableGameSignal.raise();
    }
    return;
  }
  const target = miniAppTargetForUrl(normalized, getMiniAppOrigins());
  if (target) {
    openMiniAppTarget(target, source);
    return;
  }
  router.push({
    pathname: '/webview',
    params: { url: normalized, title: title ?? '' },
  } as never);
}

/**
 * WHY: an Instagram link goes to the OS, since in the web view it never reaches the app; an embed in an iframe
 * still loads.
 */
export function handOffAppLinks(request: NavRequest): boolean {
  return handOff(request, decideNavigation(request, DECLARED_APPS));
}

export function handOffMiniAppLinks(request: NavRequest, ownOrigins: readonly string[]): boolean {
  return handOff(request, decideMiniAppNavigation(request, DECLARED_APPS, ownOrigins));
}

function handOff(request: NavRequest, decision: NavDecision): boolean {
  if (handsOffToOs(request)) {
    void openExternalUrl(request.url).catch(() => {});
    return false;
  }
  if (decision.kind === 'load') return true;
  if (decision.kind === 'open') {
    const { url, fallback } = decision;
    void openExternalUrl(url)
      .catch(() => (fallback ? openExternalUrl(fallback) : undefined))
      .catch(() => {});
  }
  return false;
}

/**
 * QUIRK(react-native): only `canOpenURL` is gated by declared schemes (iOS, Android 11+), so the app scheme
 * is opened outright and a rejection falls back to `url`. Both must pass the allowlist; the fallback stays external, since a second
 * web view over a mini app would stack two browsers.
 */
export interface ExternalTarget {
  url: string;
  appUrl?: string;
}

function allowedApp(appUrl: string, appSchemes: readonly string[]): boolean {
  const scheme = schemeOf(appUrl);
  return !!scheme && appSchemes.includes(scheme);
}

export async function openAppFirst(
  { url, appUrl }: ExternalTarget,
  open: (url: string) => Promise<unknown>,
  appSchemes: readonly string[],
): Promise<void> {
  if (!isOpenableUrl(url, appSchemes)) {
    // WHY: the scheme alone; the rest of a page's URL may carry a user's data.
    logHandledError('web/open-url-refused', new Error(`refused scheme: ${schemeOf(url) ?? 'none'}`));
    return;
  }
  if (appUrl && allowedApp(appUrl, appSchemes)) {
    try {
      await open(appUrl);
      return;
    } catch {
    }
  }
  await open(url).catch(() => {});
}

/** WHY: call it only after the origin gate granted `web:action`; a page's action and a server's share one path. */
export function performWebAction(actionType: string, actionValue: string, source?: EntrySource): void {
  const action = resolveWebAction(actionType, actionValue);
  if (!action) {
    if (__DEV__) console.debug('[webview] web:action refused:', actionType, actionValue);
    return;
  }
  handleSduiAction({ ...action, source });
}

interface SduiAction {
  actionType: ActionType;
  actionValue: string;
  webviewTitle?: string;
  /** WHY: accepted and unused, kept so call sites and the server contract need not change. */
  webviewColor?: string;
  /** WHY: analytics only, read back by the opened screen (`asEntrySource`); not part of the server contract. */
  source?: EntrySource;
  /** WHY: the place's close returns to this page; not part of the server contract. */
  origin?: PageOrigin;
}

export function handleSduiAction({
  actionType,
  actionValue,
  webviewTitle,
  source,
  origin,
}: SduiAction): void {
  switch (actionType) {
    case 'route': {
      // QUIRK(expo-router): `router.push('/')` leaves a titleless index entry in the root Stack; dismissTo pops to
      // home when it is in history, else navigates, since v4 dropped navigate's smart behavior (expo/expo#35212).
      if (actionValue === '/') {
        router.dismissTo('/(tabs)/home' as never);
        break;
      }
      // WHY: `/map` has no screen of its own; a route to a place there is the link grammar a
      // server place carries (`/map?place=<kind>:<id>`), so it opens as the `map` arm does.
      const link = parseIncomingLink(actionValue);
      if (link.pathname === '/map') {
        const ref = parseMapPlaceRef(link.params.get('place'));
        if (ref) mapPlaceOpener(ref, source, origin);
        else if (__DEV__) console.debug('[sdui] map route with no valid place ignored:', actionValue);
        break;
      }
      router.push((source ? withEntrySource(actionValue, source) : actionValue) as never);
      break;
    }

    // WHY: both verbs stay because the server still emits both; what the page may do is decided by its origin.
    case 'webview':
    case 'external':
      openWebView({ url: actionValue, title: webviewTitle, source });
      break;

    // WHY: a value that is not a mini-app target does nothing; it is never read as a URL.
    case 'miniapp': {
      const target = parseMiniAppTarget(actionValue);
      if (target) {
        openMiniAppTarget(target, source);
      } else if (__DEV__) {
        console.debug('[sdui] miniapp action with no valid target ignored:', actionValue);
      }
      break;
    }

    // WHY: a value that is not a place reference does nothing.
    case 'map': {
      const ref = parseMapPlaceRef(actionValue);
      if (ref) {
        mapPlaceOpener(ref, source, origin);
      } else if (__DEV__) {
        console.debug('[sdui] map action with no valid place ignored:', actionValue);
      }
      break;
    }

    case 'content':
    case 'unknown':
      // WHY: `content` renders in its sheet, which handles it before calling here; `unknown` must never open a
      // browser.
      if (__DEV__) {
        console.debug('[sdui] non-navigable action type ignored:', actionType);
      }
      break;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}
