/**
 * A tap on the promo card, over the real web service, games client, schema,
 * cache and app config: the app switches to the mini-app tab first, and the
 * game opens on top of it once the pending link is drained, with the slot as
 * its source. Only the HTTP client, MMKV, the router and analytics are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheAppConfigResponse, queryClient, resetAppConfigMemo } from '@skkuverse/shared';
import { openPendingMiniAppLink, pendingMiniAppLink, resetGameOpens } from '@/features/web/web.service';
import { resetMMKV } from '../../../test-support/react-native-mmkv';
import { PROMO_CREATIVES } from './promo.constants';
import { openPromoCreative, openPromoTile } from './promo.service';

const http = vi.hoisted(() => ({ routes: new Map<string, unknown>() }));
const router = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn(), dismissTo: vi.fn() }));
const analytics = vi.hoisted(() => ({ markTabSwitch: vi.fn(), track: vi.fn() }));

vi.mock('expo-router', () => ({ router }));
vi.mock('@/platform/analytics', () => analytics);
vi.mock('@/platform/dev-log', () => ({ devLog: vi.fn() }));
vi.mock('@/platform/handoff', () => ({ openExternalUrl: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => ({
    get: async (path: string) => {
      if (!http.routes.has(path)) throw Object.assign(new Error('Service Unavailable'), { isAxiosError: true });
      return { data: { meta: {}, data: http.routes.get(path) } };
    },
  }),
}));

const SUIKA = 'https://suika-game.game.skkuverse.com';
const WAVE = 'https://wave-run.game.skkuverse.com';
const STACK = 'https://building-stack.game.skkuverse.com';
const APP_CONFIG = {
  ios: { minVersion: '0.0.0', updateUrl: null },
  android: { minVersion: '0.0.0', updateUrl: null },
  webview: { bridgeOrigins: [] },
  web: { origin: 'https://skkuverse.com' },
  miniapps: { origins: {} },
  games: { origins: { [SUIKA]: 'suika-game', [WAVE]: 'wave-run', [STACK]: 'building-stack' } },
};
const REGISTRY = {
  games: [
    { id: 'wave-run', entryUrl: `${WAVE}/`, enabled: true, minHostProtocol: 1 },
    { id: 'suika-game', entryUrl: `${SUIKA}/`, enabled: true, minHostProtocol: 1 },
  ],
};
const [WAVE_CREATIVE] = PROMO_CREATIVES;

beforeEach(() => {
  resetMMKV();
  resetAppConfigMemo();
  queryClient.clear();
  http.routes.clear();
  router.push.mockClear();
  router.navigate.mockClear();
  analytics.markTabSwitch.mockClear();
  analytics.track.mockClear();
  resetGameOpens();
  pendingMiniAppLink.consume();
  cacheAppConfigResponse(APP_CONFIG);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
});

describe('openPromoCreative', () => {
  it('switches to the mini-app tab, as the app and not the user, before it leaves the game to open', () => {
    // Arrange
    const navigatedWhenSet: boolean[] = [];
    const unsubscribe = pendingMiniAppLink.subscribe(() => navigatedWhenSet.push(router.navigate.mock.calls.length > 0));

    // Act
    openPromoCreative('transit_top', WAVE_CREATIVE!);
    unsubscribe();

    // Assert
    expect(analytics.track.mock.calls).toEqual([
      ['promo_tap', { slot: 'transit_top', creative_id: 'wave-run', target: 'wave-run' }],
    ]);
    expect(analytics.markTabSwitch).toHaveBeenCalledWith('home', 'promo');
    expect(router.navigate.mock.calls).toEqual([['/(tabs)/home']]);
    expect(navigatedWhenSet).toEqual([true]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the game over the mini-app tab once the link is drained, with the slot as its source', async () => {
    // Arrange
    http.routes.set('/games', REGISTRY);
    openPromoCreative('transit_top', WAVE_CREATIVE!);

    // Act
    openPendingMiniAppLink(() => '/home');

    // Assert
    await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(router.push.mock.calls).toEqual([
      [{ pathname: '/games/[id]', params: { id: 'wave-run', source: 'promo:transit_top' } }],
    ]);
  });
});

describe('openPromoTile', () => {
  it('logs the tap with the page slot and opens the game with it as its source', async () => {
    // Arrange
    http.routes.set('/games', {
      games: [{ id: 'building-stack', entryUrl: `${STACK}/`, enabled: true, minHostProtocol: 1 }],
    });

    // Act
    openPromoTile('miniapp_games', 'building-stack');

    // Assert
    expect(analytics.track.mock.calls).toEqual([
      ['promo_tap', { slot: 'miniapp_games', creative_id: 'building-stack', target: 'building-stack' }],
    ]);
    await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(router.push.mock.calls).toEqual([
      [{ pathname: '/games/[id]', params: { id: 'building-stack', source: 'promo:miniapp_games' } }],
    ]);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
