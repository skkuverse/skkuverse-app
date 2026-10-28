export interface PlatformConfig {
  minVersion: string;
  updateUrl: string | null;
  /**
   * WHY: below this OS the store has no build satisfying `minVersion`, so the force-update gate lets the
   * device in; null keeps the app's own fallback.
   */
  minOsVersion: string | null;
}

export interface WebviewConfig {
  /**
   * CONTRACT(skkuverse-server): skkuverse-server/src/infra/origins.ts. Bare origins, since the client
   * compares them against `new URL(pageUrl).origin`.
   */
  bridgeOrigins: string[];
}

export interface WebConfig {
  /** WHY: on null, callers degrade rather than fall back to a hardcoded host, a second source of truth. */
  origin: string | null;
}

export interface MiniAppsConfig {
  /**
   * CONTRACT(skkuverse-server): skkuverse-server/src/app-config/app-config.service.ts. A URL on one of
   * these opens in its mini app's shell, since in /webview the page's SDK finds no bridge.
   */
  origins: Readonly<Record<string, string>>;
}

export interface GamesConfig {
  /**
   * CONTRACT(skkuverse-server): skkuverse-server/src/app-config/app-config.service.ts. A trust list of
   * its own, never in `bridgeOrigins` or `miniapps.origins`; empty means no hosted game (fail closed).
   */
  origins: Readonly<Record<string, string>>;
}

export interface AppConfig {
  ios: PlatformConfig;
  android: PlatformConfig;
  webview: WebviewConfig;
  web: WebConfig;
  miniapps: MiniAppsConfig;
  games: GamesConfig;
}
