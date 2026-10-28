/**
 * A URL on a first-party game origin, over the real service, client, schema,
 * cache and app config (spec games/game-host): it opens the game's screen, not
 * the mini-app shell or /webview, once the games registry has answered. It is
 * an in-app tap, so when the registry hides the game, does not list it, or
 * cannot be read with nothing cached, or the build cannot open it, nothing
 * happens and the page stays on screen ("Only external entries are sent
 * home"). Only the HTTP client, MMKV and the router are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheAppConfigResponse, queryClient, resetAppConfigMemo, writeCache } from '@skkuverse/shared';
import { openWebView, resetGameOpens, unopenableGameTap } from './web.service';
import { resetMMKV } from '../../../test-support/react-native-mmkv';
import listed from '../games/__fixtures__/game-index.apple-game-listed.json';

const http = vi.hoisted(() => ({ routes: new Map<string, unknown>(), down: false, requests: [] as string[] }));
const router = vi.hoisted(() => ({ push: vi.fn(), dismissTo: vi.fn() }));
const devLog = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({ router }));
vi.mock('@/platform/dev-log', () => ({ devLog }));
vi.mock('@/platform/handoff', () => ({ openExternalUrl: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      http.requests.push(path);
      if (http.down) throw Object.assign(new Error('Network Error'), { isAxiosError: true });
      if (!http.routes.has(path)) {
        throw Object.assign(new Error('Service Unavailable'), {
          isAxiosError: true,
          response: { status: 503, data: { error: { code: 'GAME_REGISTRY_UNAVAILABLE', message: 'unavailable' } } },
        });
      }
      return { data: { meta: {}, data: http.routes.get(path) } };
    },
  }),
}));

const APPLE = 'https://apple-game.game.skkuverse.com';
const SUIKA = 'https://suika-game.game.skkuverse.com';
const WAVE = 'https://wave-run.game.skkuverse.com';
const STRANGER = 'https://chess.game.skkuverse.com';
const HSSC = 'https://hssc.skkuverse.com';

const APP_CONFIG = {
  ios: { minVersion: '0.0.0', updateUrl: null },
  android: { minVersion: '0.0.0', updateUrl: null },
  webview: { bridgeOrigins: [] },
  web: { origin: 'https://skkuverse.com' },
  miniapps: { origins: { [HSSC]: 'hssc' } },
  games: { origins: { [APPLE]: 'apple-game', [SUIKA]: 'suika-game', [WAVE]: 'wave-run', [STRANGER]: 'chess' } },
};

const toGame = (id: string, source: string) => ({ pathname: '/games/[id]', params: { id, source } });

/** Waits until the open either pushed a screen or decided it opens nothing. */
async function settled(): Promise<void> {
  await vi.waitFor(() => {
    const unopenable = devLog.mock.calls.some(([event]) => event === 'game.unopenable');
    if (router.push.mock.calls.length === 0 && !unopenable) throw new Error('still resolving');
  });
}

beforeEach(() => {
  resetMMKV();
  resetAppConfigMemo();
  queryClient.clear();
  http.routes.clear();
  http.down = false;
  http.requests = [];
  router.push.mockClear();
  router.dismissTo.mockClear();
  devLog.mockClear();
  resetGameOpens();
  cacheAppConfigResponse(APP_CONFIG);
});

describe('openWebView on a game origin', () => {
  it('opens a listed, enabled game, with the source a mini app would get', async () => {
    // Arrange
    http.routes.set('/games', listed.data);

    // Act
    openWebView({ url: `${APPLE}/some/page?x=1`, source: 'sdui' });
    await settled();

    // Assert
    expect(router.push.mock.calls).toEqual([[toGame('apple-game', 'sdui')]]);
    expect(http.requests).toEqual(['/games']);
  });

  it('says other when the caller names no source', async () => {
    // Arrange
    http.routes.set('/games', listed.data);

    // Act
    openWebView({ url: `${APPLE}/` });
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith(toGame('apple-game', 'other'));
  });

  it('leaves the page on screen for a game the registry does not list, and says so', async () => {
    // Arrange
    http.routes.set('/games', listed.data);
    const toast = vi.fn();
    const unsubscribe = unopenableGameTap.subscribe(toast);

    // Act
    openWebView({ url: `${WAVE}/`, source: 'webview' });
    await settled();
    unsubscribe();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'wave-run', why: 'unknown', whenUnopenable: 'stay' });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('leaves the page on screen for a disabled game', async () => {
    // Arrange
    http.routes.set('/games', listed.data);

    // Act
    openWebView({ url: `${SUIKA}/` });
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'suika-game', why: 'hidden', whenUnopenable: 'stay' });
  });

  it('leaves the page on screen for a game too new for this host', async () => {
    // Arrange
    http.routes.set('/games', { games: [{ ...listed.data.games[0], minHostProtocol: 99 }] });

    // Act
    openWebView({ url: `${APPLE}/` });
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('leaves the page on screen for a game origin this build has no first-party config for, without asking', () => {
    // Arrange
    const toast = vi.fn();
    const unsubscribe = unopenableGameTap.subscribe(toast);

    // Act
    openWebView({ url: `${STRANGER}/` });
    unsubscribe();

    // Assert
    expect(toast).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'chess', why: 'no first-party config', whenUnopenable: 'stay' });
    expect(http.requests).toEqual([]);
  });

  it('decides from the cached registry when the fetch fails', async () => {
    // Arrange
    writeCache('games:index:v1', listed.data);
    http.down = true;

    // Act
    openWebView({ url: `${SUIKA}/` });
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('leaves the page on screen when the registry is unreachable and nothing is cached', async () => {
    // Arrange: the server answers 503 GAME_REGISTRY_UNAVAILABLE.

    // Act
    openWebView({ url: `${SUIKA}/` });
    await settled();

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('game.unopenable', { id: 'suika-game', why: 'unknown', whenUnopenable: 'stay' });
  });

  it('still opens a mini-app origin in its shell, and any other page in /webview', () => {
    // Act
    openWebView({ url: `${HSSC}/student/notice2.do`, source: 'webview' });
    openWebView({ url: 'https://www.skku.edu/notice.do', title: 'Notice' });

    // Assert
    expect(router.push.mock.calls).toEqual([
      [{ pathname: '/mini-app', params: { id: 'hssc', path: '/student/notice2.do', source: 'webview' } }],
      [{ pathname: '/webview', params: { url: 'https://www.skku.edu/notice.do', title: 'Notice' } }],
    ]);
    expect(http.requests).toEqual([]);
  });

  it('opens a game origin in /webview when the config lists no game origins', () => {
    // Arrange: a config cached before the server sent `games`.
    resetMMKV();
    resetAppConfigMemo();
    cacheAppConfigResponse({ ...APP_CONFIG, games: undefined });

    // Act
    openWebView({ url: `${APPLE}/`, title: '' });

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/webview', params: { url: `${APPLE}/`, title: '' } });
  });
});
