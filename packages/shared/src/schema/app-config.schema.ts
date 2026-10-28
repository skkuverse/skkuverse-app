// CONTRACT(skkuverse-server): skkuverse-server/src/app-config/ serves GET /app/config and publishes its fixtures
// as app-config.appClientConfig.
import { z } from 'zod';
import type { ApiEnvelope } from '../api/types';
import { parsedBy, text, tolerantArray } from './tolerant';
import type { AppConfig } from './app-config.types';

export type { AppConfig, GamesConfig, MiniAppsConfig, PlatformConfig, WebConfig, WebviewConfig } from './app-config.types';

/** WHY: a section that is not an object reads as an empty one, so each field falls back alone and no response fails. */
function section<S extends z.ZodRawShape>(shape: S) {
  return z
    .record(z.string(), z.unknown())
    .catch(() => ({}))
    .pipe(z.object(shape));
}

/** WHY: an http origin is trivially spoofable on a hostile network, and one URL cannot read never matches a page's. */
function httpsOriginOf(value: string): string | null {
  try {
    const { origin, protocol } = new URL(value);
    return protocol === 'https:' ? origin : null;
  } catch {
    return null;
  }
}

const httpsOrigin = parsedBy((value) => (typeof value === 'string' ? httpsOriginOf(value) : null));

const platform = (osFloor: RegExp) =>
  section({
    // WHY: 0.0.0 forces no one to update.
    minVersion: text.catch('0.0.0'),
    updateUrl: text.nullable().catch(null),
    minOsVersion: z.string().regex(osFloor).nullable().catch(null),
  });

// WHY: games and mini apps share one id namespace, so one grammar serves both maps.
const registryId = z.string().regex(/^[a-z0-9-]+$/);

/** WHY: a key stays only when it is already the bare origin a page's URL yields, or it could never match one. */
const originKey = z.string().refine((key) => httpsOriginOf(key) === key);

const originMap = (where: string) =>
  section({
    origins: z
      .record(z.string(), z.unknown())
      .transform((map): unknown[] => Object.entries(map))
      .pipe(tolerantArray(z.tuple([originKey, registryId]), where))
      .transform((entries) => Object.fromEntries(entries))
      .catch(() => ({})),
  });

export const appConfigSchema = section({
  ios: platform(/^\d+(\.\d+){0,2}$/),
  android: platform(/^\d+$/),
  webview: section({
    /**
     * WHY: fails closed: a malformed list grants the bridge to nobody, never a baked-in list, which would
     * hand `Linking.openURL` to an unvetted page. `new URL().origin` lets a path or slash still match.
     */
    bridgeOrigins: tolerantArray(httpsOrigin, 'appConfig.webview.bridgeOrigins')
      .transform((origins) => [...new Set(origins)])
      .catch(() => []),
  }),
  web: section({ origin: httpsOrigin.nullable().catch(null) }),
  miniapps: originMap('appConfig.miniapps.origins'),
  games: originMap('appConfig.games.origins'),
}) satisfies z.ZodType<AppConfig>;

export function parseAppConfig(envelope: ApiEnvelope<unknown>): AppConfig {
  return appConfigSchema.parse(envelope.data);
}
