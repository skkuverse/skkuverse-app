/**
 * A failed `/app/config` fetch (network error, 5xx, an unreadable body) must
 * not open the force-update gate: the gate falls back to the last good config,
 * the same cache every other consumer reads. With nothing cached it lets the
 * user in, since no data must not trap anyone. Only the transport and the
 * native version are doubles; the parser, the cache and the rules are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { createMMKV, resetMMKV } from '../../test-support/react-native-mmkv';
import { cacheAppConfigResponse, getCachedAppConfig, resetAppConfigMemo } from '@skkuverse/shared';
import { checkForceUpdate } from './app-config.client';

type Fetch = { ok: true; data: unknown } | { ok: false };
let fetch: Fetch = { ok: false };

vi.mock('@skkuverse/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@skkuverse/shared')>();
  return {
    ...actual,
    safeGet: (_url: string, parse: (envelope: unknown) => unknown) =>
      Promise.resolve(
        fetch.ok
          ? { ok: true, data: parse({ meta: { code: 200 }, data: fetch.data }) }
          : { ok: false, failure: { type: 'server', status: 503 } },
      ),
  };
});
vi.mock('expo-application', () => ({ nativeApplicationVersion: '3.6.1' }));

const STORE = 'https://apps.apple.com/app/id1';
const blocking = { ios: { minVersion: '3.6.2', updateUrl: STORE, minOsVersion: '16.4' } };
const passing = { ios: { minVersion: '3.6.0', updateUrl: STORE, minOsVersion: '16.4' } };

/** Seed the cache as an earlier launch's successful fetch would, then forget this session. */
function cachedFromEarlierLaunch(data: unknown) {
  cacheAppConfigResponse(data);
  resetAppConfigMemo();
}

beforeEach(() => {
  resetMMKV();
  resetAppConfigMemo();
  fetch = { ok: false };
  Platform.Version = '26.0';
});

describe('checkForceUpdate when the fetch fails', () => {
  it('blocks when the last good config blocks', async () => {
    cachedFromEarlierLaunch(blocking);
    expect(await checkForceUpdate()).toEqual({ required: true, updateUrl: STORE });
  });

  it('lets in when the last good config passes', async () => {
    cachedFromEarlierLaunch(passing);
    expect(await checkForceUpdate()).toEqual({ required: false, updateUrl: STORE });
  });

  it('lets in when nothing was ever cached', async () => {
    expect(await checkForceUpdate()).toEqual({ required: false, updateUrl: null });
  });

  it('lets in when the cached copy is unreadable', async () => {
    const cache = createMMKV({ id: 'skkuverse-cache' });
    for (const junk of ['{not json', '[1]', 'null', '"3.6.2"']) {
      cache.set('app-config:v2', junk);
      resetAppConfigMemo();
      expect(await checkForceUpdate()).toEqual({ required: false, updateUrl: null });
    }
  });

  it('applies the OS floor to the cached config too', async () => {
    cachedFromEarlierLaunch(blocking);
    Platform.Version = '16.3.1';
    expect((await checkForceUpdate()).required).toBe(false);
    // No server floor cached: the app's own iOS floor still exempts it.
    cachedFromEarlierLaunch({ ios: { minVersion: '3.6.2', updateUrl: STORE } });
    expect((await checkForceUpdate()).required).toBe(false);
  });

  it('treats a body that is not a config as a failure, keeping the last good copy', async () => {
    cachedFromEarlierLaunch(blocking);
    fetch = { ok: true, data: null };
    expect((await checkForceUpdate()).required).toBe(true);
    expect(getCachedAppConfig()?.ios.minVersion).toBe('3.6.2');
  });
});

describe('checkForceUpdate when the fetch succeeds', () => {
  it('follows the fresh config over a stale cache, and caches it', async () => {
    cachedFromEarlierLaunch(blocking);
    fetch = { ok: true, data: passing };
    expect(await checkForceUpdate()).toEqual({ required: false, updateUrl: STORE });
    resetAppConfigMemo();
    expect(getCachedAppConfig()?.ios.minVersion).toBe('3.6.0');
  });

  it('blocks on a fresh config with nothing cached before', async () => {
    fetch = { ok: true, data: blocking };
    expect(await checkForceUpdate()).toEqual({ required: true, updateUrl: STORE });
  });
});
