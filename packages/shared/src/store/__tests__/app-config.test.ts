/**
 * The app config cache keeps the server's raw `data` and parses it on read with
 * the parser a fetch uses (ADR 0020 D7), so a copy written by an older bundle
 * reads what a fresh fetch would. Only MMKV is a double.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cacheAppConfigResponse,
  getBridgeOrigins,
  getCachedAppConfig,
  getGameOrigins,
  getMiniAppOrigins,
  resetAppConfigMemo,
} from '../app-config';
import { parseAppConfig } from '../../schema/app-config.schema';

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => stored.get(key),
    set: (key: string, value: string) => {
      stored.set(key, value);
    },
    remove: (key: string) => stored.delete(key),
  }),
}));

const RESPONSE = {
  ios: { minVersion: '3.0.0', updateUrl: 'https://apps.apple.com/app/id1' },
  android: { minVersion: '3.0.0', updateUrl: 'https://play.google.com/store/apps/details?id=a' },
  webview: { bridgeOrigins: ['https://webview.skkuverse.com'] },
  web: { origin: 'https://skkuverse.com' },
  miniapps: { origins: { 'https://hssc.skkuverse.com': 'hssc' } },
};

const parse = (data: unknown) => parseAppConfig({ meta: { code: 200 }, data });

beforeEach(() => {
  stored.clear();
  resetAppConfigMemo();
});

describe('the app config cache', () => {
  it('reads a cached response exactly as a fresh fetch parses it', () => {
    // Arrange
    cacheAppConfigResponse(RESPONSE);
    resetAppConfigMemo();

    // Act
    const cached = getCachedAppConfig();

    // Assert
    expect(cached).toStrictEqual(parse(RESPONSE));
  });

  it('reads a field from a response an older bundle cached', () => {
    // Arrange: an older bundle stored the raw response, with a field it never read.
    stored.set('app-config:v2', JSON.stringify(RESPONSE));

    // Act
    const origins = getMiniAppOrigins();

    // Assert
    expect(origins).toStrictEqual({ 'https://hssc.skkuverse.com': 'hssc' });
  });

  it('ignores a parsed copy under the retired key', () => {
    // Arrange
    stored.set('app-config:v1', JSON.stringify(parse(RESPONSE)));

    // Act
    const origins = getBridgeOrigins();

    // Assert
    expect(origins).toStrictEqual([]);
  });

  it('removes the retired key once a response is cached', () => {
    // Arrange
    stored.set('app-config:v1', JSON.stringify(parse(RESPONSE)));

    // Act
    cacheAppConfigResponse(RESPONSE);

    // Assert
    expect(stored.has('app-config:v1')).toBe(false);
    expect(JSON.parse(stored.get('app-config:v2') ?? 'null')).toStrictEqual(RESPONSE);
  });

  it('keeps the last good copy when a response is not an object', () => {
    // Arrange
    cacheAppConfigResponse(RESPONSE);

    // Act
    cacheAppConfigResponse('not a config');
    cacheAppConfigResponse(null);
    resetAppConfigMemo();

    // Assert
    expect(getBridgeOrigins()).toStrictEqual(['https://webview.skkuverse.com']);
    expect(getMiniAppOrigins()).toStrictEqual({ 'https://hssc.skkuverse.com': 'hssc' });
  });

  it('reads the game origins from a cached response', () => {
    // Arrange
    cacheAppConfigResponse({ ...RESPONSE, games: { origins: { 'https://apple-game.game.skkuverse.com': 'apple-game' } } });
    resetAppConfigMemo();

    // Act
    const origins = getGameOrigins();

    // Assert
    expect(origins).toStrictEqual({ 'https://apple-game.game.skkuverse.com': 'apple-game' });
  });

  it('has no game origins from a response cached before the key, or with nothing cached', () => {
    // Arrange: nothing cached.
    // Act / Assert
    expect(getGameOrigins()).toStrictEqual({});

    // Arrange: a body an older server sent, without `games`.
    stored.set('app-config:v2', JSON.stringify(RESPONSE));
    resetAppConfigMemo();

    // Act / Assert
    expect(getGameOrigins()).toStrictEqual({});
  });
});
