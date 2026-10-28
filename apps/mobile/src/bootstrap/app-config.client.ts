import { Platform } from 'react-native';
import * as Application from 'expo-application';
import {
  safeGet,
  ApiEndpoints,
  cacheAppConfigResponse,
  getCachedAppConfig,
  type ApiEnvelope,
  API_TIMEOUT_MS,
} from '@skkuverse/shared';
import { isForceUpdateRequired } from './force-update.rules';

export interface ForceUpdateResult {
  required: boolean;
  updateUrl: string | null;
}

export function cachedUpdateUrl(): string | null {
  const cached = getCachedAppConfig();
  if (!cached) return null;
  return cached[Platform.OS === 'ios' ? 'ios' : 'android'].updateUrl;
}

export async function checkForceUpdate(): Promise<ForceUpdateResult> {
  const appVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  const result = await safeGet(
    ApiEndpoints.appConfig(),
    (envelope: ApiEnvelope<unknown>) => envelope.data,
    { timeout: API_TIMEOUT_MS.boot },
  );

  // WHY: seeds the cache that a bridge `onMessage` reads synchronously for `webview.bridgeOrigins` and `web.origin`.
  if (result.ok) cacheAppConfigResponse(result.data);

  // WHY: a failed fetch is judged on the last good config, or a server 503 would open the gate for every launch.
  const cached = getCachedAppConfig();
  // WHY: only a device that never cached a config is let in; no data must not trap anyone.
  if (!cached) return { required: false, updateUrl: null };

  const config = cached[platform];
  return {
    required: isForceUpdateRequired({
      platform,
      osVersion: String(Platform.Version),
      appVersion,
      minVersion: config.minVersion,
      minOsVersion: config.minOsVersion,
    }),
    updateUrl: config.updateUrl,
  };
}
