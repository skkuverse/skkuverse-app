/**
 * A mini-app deep link or push tap over the real service, client, schema and
 * cache (spec web/miniapp-registry, games/game-host): a first-party game opens
 * once the games registry answers, and home when the registry hides it, does
 * not list it, or is unreachable with nothing cached; a registered slug opens its
 * shell, offline too when its detail is cached, and anything else is dropped
 * silently. A link that resolves after the user left home is dropped. An in-app
 * tap on a game that does not open leaves the user where they are, and a second
 * open of a game already opening is dropped. Only the HTTP client, MMKV and the
 * router are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheAppConfigResponse, writeCache, queryClient } from '@skkuverse/shared';
import {
  pendingMiniAppLink,
  handleSduiAction,
  handOffMiniAppLinks,
  openAppFirst,
  openMiniAppById,
  openPendingMiniAppLink,
  registerMapPlaceOpener,
  resetGameOpens,
  unopenableGameTap,
} from './web.service';
import { resetMMKV } from '../../../test-support/react-native-mmkv';
import { openExternalUrl } from '@/platform/handoff';
import { miniAppDetailQueryOptions } from './web.client';
import { OPENABLE_APP_SCHEMES } from '../../../config/external-apps';
import hssc from './__fixtures__/miniapp-detail.hssc.json';
import listedGames from '../games/__fixtures__/game-index.apple-game-listed.json';

const http = vi.hoisted(() => ({ routes: new Map<string, unknown>(), down: false, requests: [] as string[] }));
const router = vi.hoisted(() => ({ push: vi.fn(), dismissTo: vi.fn() }));
const devLog = vi.hoisted(() => vi.fn());
const logHandledError = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({ router }));
vi.mock('@/platform/dev-log', () => ({ devLog }));
// WHY: the hand-off wrappers load expo-web-browser, which Node cannot; openWebView is not under test here.
vi.mock('@/platform/handoff', () => ({ openExternalUrl: vi.fn(async () => {}) }));
// WHY: the Crashlytics SDK cannot load in Node; the unregistered-opener report has its own suite.
vi.mock('@/platform/crashlytics', () => ({ logHandledError }));
// map.service (openMapAtPlace) reads the release channel; hot-updater cannot load in Node.
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      http.requests.push(path);
      if (http.down) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
      if (!http.routes.has(path)) {
        throw Object.assign(new Error('Not Found'), {
          isAxiosError: true,
          response: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'no such mini app' } } },
        });
      }
      return { data: { meta: { lang: 'ko' }, data: http.routes.get(path) } };
    },
  }),
}));

function serve(path: string, data: unknown): void {
  http.down = false;
  http.routes.set(path, data);
}

function goOffline(): void {
  http.down = true;
}

// The game origins `/app/config` serves, as `games.origins` maps them.
const GAME_ORIGINS = {
  'https://apple-game.game.skkuverse.com': 'apple-game',
  'https://suika-game.game.skkuverse.com': 'suika-game',
};

/** Where the user is, as the consumer's `usePathname` ref reads it. */
let at = '/home';
const here = () => at;

const ENDS = ['pendingMiniApp.unresolved', 'pendingMiniApp.left', 'game.unopenable'];

/** Waits until the link was either opened, dropped, or sent home. */
async function settled(): Promise<void> {
  await vi.waitFor(() => {
    const dropped = devLog.mock.calls.some(([event]) => ENDS.includes(event as string));
    if (router.push.mock.calls.length === 0 && router.dismissTo.mock.calls.length === 0 && !dropped) {
      throw new Error('still resolving');
    }
  });
}

beforeEach(() => {
  resetMMKV();
  queryClient.clear();
  http.routes.clear();
  http.down = false;
  http.requests = [];
  router.push.mockClear();
  router.dismissTo.mockClear();
  devLog.mockClear();
  logHandledError.mockClear();
  resetGameOpens();
  cacheAppConfigResponse({ games: { origins: GAME_ORIGINS } });
  at = '/home';
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 0;
  });
});

describe('openPendingMiniAppLink', () => {
  it('lands on home offline once the games registry proves unreachable, with nothing cached', async () => {
    // Arrange
    goOffline();
    pendingMiniAppLink.set({ id: 'wave-run' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/home');
    expect(http.requests).toEqual(['/games']);
  });

  it('names a push tap as the source of a game', async () => {
    // Arrange
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'apple-game', via: 'push' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'push' } });
  });

  it('opens a listed, enabled game', async () => {
    // Arrange
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'apple-game' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'deeplink' } });
  });

  it('lands on home for a disabled game, with no toast: home is the answer', async () => {
    // Arrange
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'suika-game' });
    const toast = vi.fn();
    const unsubscribe = unopenableGameTap.subscribe(toast);

    // Act
    openPendingMiniAppLink(here);
    await settled();
    unsubscribe();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/home');
    expect(toast).not.toHaveBeenCalled();
  });

  it('decides a disabled game from the cached registry offline', async () => {
    // Arrange
    writeCache('games:index:v1', listedGames.data);
    goOffline();
    pendingMiniAppLink.set({ id: 'suika-game' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('drops a link to a game the registry lists but this build has no config for', async () => {
    // Arrange
    serve('/games', { games: [{ id: 'chess', entryUrl: 'https://chess.game.skkuverse.com/', enabled: true, minHostProtocol: 1 }] });
    pendingMiniAppLink.set({ id: 'chess' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.unresolved', { id: 'chess' });
  });

  it('opens a registered mini app at its path, as a deep link', async () => {
    // Arrange
    serve('/miniapps/hssc', hssc.data);
    pendingMiniAppLink.set({ id: 'hssc', path: '/student/notice2.do' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mini-app',
      params: { id: 'hssc', path: '/student/notice2.do', source: 'deeplink' },
    });
  });

  it('names a push tap as its source', async () => {
    // Arrange
    serve('/miniapps/hssc', hssc.data);
    pendingMiniAppLink.set({ id: 'hssc', via: 'push' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/mini-app', params: { id: 'hssc', source: 'push' } });
  });

  it('drops an unknown slug silently', async () => {
    // Arrange
    pendingMiniAppLink.set({ id: 'not-a-mini-app' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.unresolved', { id: 'not-a-mini-app' });
  });

  it('opens the current detail online, not the cached one', async () => {
    // Arrange
    writeCache('miniapp:detail:v3:hssc', { ...hssc.data, startUrl: 'https://old.example.com/' });
    serve('/miniapps/hssc', hssc.data);
    let openedAt: string | undefined;
    router.push.mockImplementationOnce(() => {
      openedAt = queryClient.getQueryData(miniAppDetailQueryOptions('hssc').queryKey)?.startUrl;
    });
    pendingMiniAppLink.set({ id: 'hssc' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(openedAt).toBe(hssc.data.startUrl);
  });

  it('opens offline from a cached detail', async () => {
    // Arrange
    writeCache('miniapp:detail:v3:hssc', hssc.data);
    goOffline();
    pendingMiniAppLink.set({ id: 'hssc' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/mini-app', params: { id: 'hssc', source: 'deeplink' } });
  });

  it('drops a link offline with nothing cached', async () => {
    // Arrange
    goOffline();
    pendingMiniAppLink.set({ id: 'hssc' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.unresolved', { id: 'hssc' });
  });

  it('drops a game link that resolves after the user left home', async () => {
    // Arrange
    let answer: (() => void) | undefined;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const fetching = vi.spyOn(queryClient, 'query').mockImplementationOnce(async (options) => {
      await answered;
      serve('/games', listedGames.data);
      fetching.mockRestore();
      return queryClient.query(options as never);
    });
    pendingMiniAppLink.set({ id: 'apple-game' });

    // Act
    openPendingMiniAppLink(here);
    at = '/campus';
    answer?.();
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.left', { id: 'apple-game', at: '/campus' });
  });

  it('does not send a user who left home back there for a game that does not open', async () => {
    // Arrange
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'suika-game' });
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      at = '/notices';
      callback();
      return 0;
    });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.left', { id: 'suika-game', at: '/notices' });
  });

  it('drops a mini-app link that resolves after the user left home', async () => {
    // Arrange
    serve('/miniapps/hssc', hssc.data);
    pendingMiniAppLink.set({ id: 'hssc' });

    // Act
    openPendingMiniAppLink(here);
    at = '/transit';
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('pendingMiniApp.left', { id: 'hssc', at: '/transit' });
  });

  it('opens a push tap whose home navigate has not reached the pathname yet', async () => {
    // Arrange
    at = '/notices';
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'apple-game', via: 'push' });

    // Act
    openPendingMiniAppLink(here);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'push' } });
  });

  it('does nothing when no link is pending', () => {
    // Act
    openPendingMiniAppLink(here);

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(http.requests).toEqual([]);
  });
});

describe('handleSduiAction map arm', () => {
  it('opens the place through the opener bootstrap registered, with the source', () => {
    // Arrange
    const opener = vi.fn();
    registerMapPlaceOpener(opener);

    // Act
    handleSduiAction({ actionType: 'map', actionValue: '21402', source: 'sdui' });

    // Assert
    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener.mock.calls[0][0]).toStrictEqual(expect.objectContaining({ placeId: '21402' }));
    expect(opener.mock.calls[0][1]).toBe('sdui');
  });

  it('opens nothing for a value that is not a place', () => {
    // Arrange
    const opener = vi.fn();
    registerMapPlaceOpener(opener);

    // Act
    handleSduiAction({ actionType: 'map', actionValue: '', source: 'sdui' });

    // Assert
    expect(opener).not.toHaveBeenCalled();
  });
});

describe('handleSduiAction route to a map place', () => {
  it('opens the place a `/map?place=` route names, as the map arm does, and pushes no route', () => {
    // Arrange
    const opener = vi.fn();
    registerMapPlaceOpener(opener);
    router.push.mockClear();

    // Act
    handleSduiAction({ actionType: 'route', actionValue: '/map?place=subway_station:hyehwa', source: 'sdui' });

    // Assert
    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener.mock.calls[0][0]).toStrictEqual({ kind: 'subway_station', placeId: 'hyehwa' });
    expect(opener.mock.calls[0][1]).toBe('sdui');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens nothing for a `/map` route with no readable place', () => {
    // Arrange
    const opener = vi.fn();
    registerMapPlaceOpener(opener);
    router.push.mockClear();

    // Act
    handleSduiAction({ actionType: 'route', actionValue: '/map?place=', source: 'sdui' });

    // Assert
    expect(opener).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('still pushes any other route', () => {
    // Arrange
    router.push.mockClear();

    // Act
    handleSduiAction({ actionType: 'route', actionValue: '/meals' });

    // Assert
    expect(router.push).toHaveBeenCalledWith('/meals');
  });
});

describe('openMiniAppById', () => {
  it('hands a game the source a mini app gets', async () => {
    // Arrange
    serve('/games', listedGames.data);

    // Act
    openMiniAppById('apple-game', undefined, 'home_tile');
    openMiniAppById('hssc', undefined, 'home_tile');
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'home_tile' } });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/mini-app', params: { id: 'hssc', source: 'home_tile' } });
  });

  it('says other when the caller names no source', async () => {
    // Arrange
    serve('/games', listedGames.data);

    // Act
    openMiniAppById('apple-game');
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'other' } });
  });

  it('waits for the games registry on a tap before it has answered', async () => {
    // Arrange
    let answer: (() => void) | undefined;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const fetching = vi.spyOn(queryClient, 'query').mockImplementationOnce(async (options) => {
      await answered;
      serve('/games', listedGames.data);
      fetching.mockRestore();
      return queryClient.query(options as never);
    });

    // Act
    openMiniAppById('suika-game', undefined, 'home_tile');
    await Promise.resolve();
    const before = router.push.mock.calls.length + router.dismissTo.mock.calls.length;
    answer?.();
    await settled();

    // Assert
    expect(before).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('leaves the user where they are when the game does not open, and says so', async () => {
    // Arrange
    serve('/games', listedGames.data);
    const toast = vi.fn();
    const unsubscribe = unopenableGameTap.subscribe(toast);

    // Act
    openMiniAppById('suika-game', undefined, 'home_tile');
    await settled();
    unsubscribe();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'suika-game', why: 'hidden', whenUnopenable: 'stay' });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('raises no toast for a game that opens', async () => {
    // Arrange
    serve('/games', listedGames.data);
    const toast = vi.fn();
    const unsubscribe = unopenableGameTap.subscribe(toast);

    // Act
    openMiniAppById('apple-game', undefined, 'home_tile');
    await settled();
    unsubscribe();

    // Assert
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it('reports an open that throws instead of leaving the rejection unhandled', async () => {
    // Arrange
    serve('/games', listedGames.data);
    const failure = new Error('navigation root not ready');
    router.push.mockImplementationOnce(() => {
      throw failure;
    });

    // Act
    openMiniAppById('apple-game', undefined, 'home_tile');

    // Assert
    await vi.waitFor(() => expect(logHandledError).toHaveBeenCalledWith('games/open', failure));
  });

  it('opens nothing for a hosted entry off the origin games.origins maps to the id', async () => {
    // Arrange
    serve('/games', { games: [{ id: 'apple-game', entryUrl: 'https://suika-game.game.skkuverse.com/', enabled: true, minHostProtocol: 1 }] });

    // Act
    openMiniAppById('apple-game', undefined, 'home_tile');
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'apple-game', why: 'off-origin', whenUnopenable: 'stay' });
  });

  it('opens one screen for a double tap', async () => {
    // Arrange
    serve('/games', listedGames.data);

    // Act
    openMiniAppById('apple-game', undefined, 'home_tile');
    openMiniAppById('apple-game', undefined, 'home_tile');
    await settled();
    openMiniAppById('apple-game', undefined, 'home_tile');
    await Promise.resolve();

    // Assert
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(devLog).toHaveBeenCalledWith('game.open.dropped', { id: 'apple-game', why: 'in flight' });
  });

  it('opens one screen for a tap while a cold-start link to the same game resolves', async () => {
    // Arrange
    serve('/games', listedGames.data);
    pendingMiniAppLink.set({ id: 'apple-game' });

    // Act
    openPendingMiniAppLink(here);
    openMiniAppById('apple-game', undefined, 'home_tile');
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/games/[id]', params: { id: 'apple-game', source: 'deeplink' } });
  });

  it('frees the game once its screen has had time to cover the tile', async () => {
    // Arrange
    serve('/games', listedGames.data);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      openMiniAppById('apple-game', undefined, 'home_tile');
      await vi.waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

      // Act
      vi.advanceTimersByTime(1000);
      openMiniAppById('apple-game', undefined, 'home_tile');
      await vi.waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }

    // Assert
    expect(devLog).not.toHaveBeenCalledWith('game.open.dropped', expect.anything());
  });
});

// The opener and the scheme list are passed in, so a fake opener drives the reject path.
describe('openAppFirst', () => {
  const APPS = ['spotify', 'youtube', 'vnd.youtube'];

  // A fake opener that records every URL it is asked to open, and rejects the
  // ones listed — the way `Linking.openURL` rejects a scheme nothing handles.
  function opener(rejects: string[] = []) {
    const opened: string[] = [];
    const open = async (url: string) => {
      opened.push(url);
      if (rejects.includes(url)) throw new Error('no handler');
    };
    return { opened, open };
  }

  it('opens the app and stops there when the scheme is handled', async () => {
    const { opened, open } = opener();
    await openAppFirst({ url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' }, open, APPS);
    expect(opened).toStrictEqual(['spotify:track:x']);
  });

  it('falls back to the web address when the app scheme is rejected', async () => {
    const { opened, open } = opener(['spotify:track:x']);
    await openAppFirst({ url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' }, open, APPS);
    expect(opened).toStrictEqual(['spotify:track:x', 'https://open.spotify.com/track/x']);
  });

  it('opens the web address alone when there is no appUrl', async () => {
    const { opened, open } = opener();
    await openAppFirst({ url: 'https://x.test' }, open, APPS);
    expect(opened).toStrictEqual(['https://x.test']);
  });

  it('swallows a failing fallback rather than rejecting', async () => {
    const { open } = opener(['spotify:track:x', 'https://x.test']);
    await expect(openAppFirst({ url: 'https://x.test', appUrl: 'spotify:track:x' }, open, APPS)).resolves.toBeUndefined();
  });

  it('skips an appUrl whose scheme is not on the list and opens the web address', async () => {
    for (const appUrl of ['tel:0212345678', 'supertoss://send', 'javascript:alert(1)', 'not a url']) {
      const { opened, open } = opener();
      await openAppFirst({ url: 'https://x.test', appUrl }, open, APPS);
      expect(opened, appUrl).toStrictEqual(['https://x.test']);
    }
  });

  it('matches a listed scheme regardless of case', async () => {
    const { opened, open } = opener();
    await openAppFirst({ url: 'https://youtu.be/x', appUrl: 'VND.YOUTUBE:x' }, open, APPS);
    expect(opened).toStrictEqual(['VND.YOUTUBE:x']);
  });
});

// A page names the URL; only the web, the OS handlers, Apple Maps and a declared app may open.
describe('openAppFirst refuses a URL a page may not open', () => {
  function opener() {
    const opened: string[] = [];
    const open = async (url: string) => {
      opened.push(url);
    };
    return { opened, open };
  }

  it('opens nothing and reports it, without rejecting to the page', async () => {
    for (const url of [
      'javascript:alert(1)',
      'intent://x#Intent;scheme=nmap;package=com.nhn.android.nmap;end',
      'file:///etc/hosts',
      'data:text/html,<script>1</script>',
      'supertoss://send',
    ]) {
      // Arrange
      const { opened, open } = opener();
      logHandledError.mockClear();

      // Act
      await expect(openAppFirst({ url, appUrl: 'spotify:track:x' }, open, OPENABLE_APP_SCHEMES), url).resolves.toBeUndefined();

      // Assert
      expect(opened, url).toStrictEqual([]);
      expect(logHandledError, url).toHaveBeenCalledWith('web/open-url-refused', expect.any(Error));
    }
  });

  it('opens the web, the OS handlers, Apple Maps and a declared map app', async () => {
    for (const url of [
      'https://x.test',
      'http://x.test',
      'tel:0212345678',
      'mailto:help@example.com',
      'sms:01012345678',
      'nmap://place?id=1',
      'kakaomap://look?p=37.58,126.99',
      'maps://?q=37.58,126.99',
    ]) {
      // Arrange
      const { opened, open } = opener();

      // Act
      await openAppFirst({ url }, open, OPENABLE_APP_SCHEMES);

      // Assert
      expect(opened, url).toStrictEqual([url]);
    }
    expect(logHandledError).not.toHaveBeenCalled();
  });
});

describe('handOffMiniAppLinks', () => {
  const OWN = ['https://playlist.mini.skkuverse.com'];

  beforeEach(() => vi.mocked(openExternalUrl).mockClear());

  it("loads a page on the app's own origin and opens nothing", () => {
    // Act
    const loads = handOffMiniAppLinks({ url: 'https://playlist.mini.skkuverse.com/a', isTopFrame: true }, OWN);

    // Assert
    expect(loads).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('opens a page on another origin in the system browser and keeps it out of the shell', () => {
    // Act
    const loads = handOffMiniAppLinks({ url: 'https://evil.example/login', isTopFrame: true }, OWN);

    // Assert
    expect(loads).toBe(false);
    expect(openExternalUrl).toHaveBeenCalledWith('https://evil.example/login');
  });

  it('hands nothing to the OS for a scheme a page could not open by message', () => {
    // Act
    const loads = handOffMiniAppLinks({ url: 'itms-apps://x', isTopFrame: true }, OWN);

    // Assert
    expect(loads).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });
});
