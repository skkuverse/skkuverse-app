/**
 * WHY: the bridge allowlist is read synchronously in `onMessage`, where no fetch can be awaited; the
 * boot check seeds this cache before any web view opens. No bundled fallback: nothing grants nothing.
 */
import { clearCache, readCache, writeCache } from './mmkv-cache';
import { parseAppConfig, type AppConfig } from '../schema/app-config.schema';

// WHY: v2 holds the server's raw `data`, parsed on every read, so a copy an older bundle wrote still
// yields every field the current parser reads.
const CACHE_KEY = 'app-config:v2';
const RETIRED_KEYS = ['app-config:v1'] as const;

let memo: AppConfig | null = null;

function isResponse(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function parseResponse(raw: unknown): AppConfig | null {
  return isResponse(raw) ? parseAppConfig({ meta: { code: 200 }, data: raw }) : null;
}

/** WHY: a non-object `data` is not a response, so it leaves the last good copy in place. */
export function cacheAppConfigResponse(data: unknown): void {
  const config = parseResponse(data);
  if (!config) return;
  memo = config;
  writeCache(CACHE_KEY, data);
  for (const key of RETIRED_KEYS) clearCache(key);
}

/** WHY: null means grant nothing, never no restrictions. */
export function getCachedAppConfig(): AppConfig | null {
  if (memo) return memo;
  memo = readCache(CACHE_KEY, parseResponse);
  return memo;
}

export function getBridgeOrigins(): string[] {
  return getCachedAppConfig()?.webview.bridgeOrigins ?? [];
}

export function getMiniAppOrigins(): Readonly<Record<string, string>> {
  return getCachedAppConfig()?.miniapps.origins ?? {};
}

export function getGameOrigins(): Readonly<Record<string, string>> {
  return getCachedAppConfig()?.games.origins ?? {};
}

/** WHY: callers degrade on null rather than substitute a hardcoded host. */
export function getWebOrigin(): string | null {
  return getCachedAppConfig()?.web.origin ?? null;
}

export function resetAppConfigMemo(): void {
  memo = null;
}
