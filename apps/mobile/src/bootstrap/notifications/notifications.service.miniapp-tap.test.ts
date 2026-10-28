/**
 * A mini-app push whose `miniapp` target names another mini app, from the tap to the open, over
 * the real tap rule, service, web service, client and cache: a
 * registered mini app opens, an unregistered id is dropped, and a game id or a page on a game
 * origin opens the sender.
 * Only the HTTP client, MMKV, the router and the native wrappers are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheAppConfigResponse, queryClient, resetAppConfigMemo } from '@skkuverse/shared';
import { openPendingMiniAppLink } from '@/features/web/web.service';
import { resetMMKV } from '../../../test-support/react-native-mmkv';
import hssc from '../../features/web/__fixtures__/miniapp-detail.hssc.json';
import eskara from '../../features/web/__fixtures__/miniapp-detail.eskara-2026.json';
import { applyTap, resolveTap } from './notifications.service';

const http = vi.hoisted(() => ({ routes: new Map<string, unknown>(), requests: [] as string[] }));
const router = vi.hoisted(() => ({ push: vi.fn(), dismissTo: vi.fn(), navigate: vi.fn() }));
const devLog = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({ router }));
vi.mock('@/platform/dev-log', () => ({ devLog }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn() }));
// WHY: expo-notifications, expo-web-browser, Crashlytics, App Check, Firestore and hot-updater cannot load in Node.
vi.mock('@/platform/notifications', () => ({ AndroidImportance: {} }));
vi.mock('@/platform/handoff', () => ({ openExternalUrl: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));
vi.mock('@/platform/app-check', () => ({ primeAppCheck: vi.fn() }));
vi.mock('@react-native-firebase/firestore', () => ({}));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      http.requests.push(path);
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

const APPLE = 'https://apple-game.game.skkuverse.com';

const APP_CONFIG = {
  ios: { minVersion: '0.0.0', updateUrl: null },
  android: { minVersion: '0.0.0', updateUrl: null },
  webview: { bridgeOrigins: [] },
  web: { origin: 'https://skkuverse.com' },
  miniapps: { origins: {} },
  games: { origins: { [APPLE]: 'apple-game' } },
};

function tap(actionType: string, actionValue: string): void {
  applyTap(resolveTap({ type: 'miniapp', miniAppId: 'eskara-2026', actionType, actionValue }));
  // WHY: a push tap puts the user on home before the pending link opens.
  openPendingMiniAppLink(() => '/home');
}

function tapMiniAppTarget(actionValue: string): void {
  tap('miniapp', actionValue);
}

async function settled(): Promise<void> {
  await vi.waitFor(() => {
    const dropped = devLog.mock.calls.some(([event]) => event === 'pendingMiniApp.unresolved');
    if (router.push.mock.calls.length === 0 && !dropped) throw new Error('still resolving');
  });
}

beforeEach(() => {
  resetMMKV();
  resetAppConfigMemo();
  cacheAppConfigResponse(APP_CONFIG);
  queryClient.clear();
  http.routes.clear();
  http.requests = [];
  router.push.mockClear();
  devLog.mockClear();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 0;
  });
});

describe('a push tap naming another mini app', () => {
  it('opens a registered mini app at the page named', async () => {
    // Arrange
    http.routes.set('/miniapps/hssc', hssc.data);

    // Act
    tapMiniAppTarget('hssc/student/notice2.do');
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mini-app',
      params: { id: 'hssc', path: '/student/notice2.do', source: 'push' },
    });
  });

  it('opens nothing for an id the registry does not list', async () => {
    // Act
    tapMiniAppTarget('not-registered');
    await settled();

    // Assert
    expect(http.requests).toEqual(['/miniapps/not-registered']);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the sender, never the game, for a game id', async () => {
    // Arrange
    http.routes.set('/miniapps/eskara-2026', eskara.data);

    // Act
    tapMiniAppTarget('apple-game');
    await settled();

    // Assert
    expect(http.requests).toEqual(['/miniapps/eskara-2026']);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/mini-app', params: { id: 'eskara-2026', source: 'push' } });
  });
});

describe('a push tap naming a web page on a first-party game origin', () => {
  it('opens the sender, never the game', async () => {
    // Arrange
    http.routes.set('/miniapps/eskara-2026', eskara.data);

    // Act
    tap('webview', `${APPLE}/`);
    await settled();

    // Assert
    expect(router.push).toHaveBeenCalledWith({ pathname: '/mini-app', params: { id: 'eskara-2026', source: 'push' } });
  });
});
