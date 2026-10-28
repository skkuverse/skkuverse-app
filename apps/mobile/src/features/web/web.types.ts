import type { ShellConfig } from '@skkuverse/miniapp/protocol';
import type { Logo } from '@skkuverse/shared';

export interface MiniAppIndexEntry {
  /** WHY: the join key, the `/m/<id>` path, the cache key and the analytics id, so it never changes. */
  id: string;
  name: string;
  shortName?: string;
  order: number;
  /** WHY: each logo is read on its own, so one bad logo never nulls the other. */
  homeLogo: Logo | null;
  shellLogo: Logo | null;
  /** WHY: off the home grid only; deep links, map buttons and the shell still open it. */
  hidden?: boolean;
}

export interface MiniAppIndex {
  version: number;
  miniApps: MiniAppIndexEntry[];
}

export interface MiniAppLink {
  label?: string;
  url: string;
}

export interface MiniAppNoticeBanner {
  title: string;
  subtitle: string;
}

/**
 * WHY: the protocol's shape and parser (`@skkuverse/miniapp/protocol`), so the server, the SDK and the app read one
 * definition.
 */
export type MiniAppShell = ShellConfig;

export interface MiniAppDetail {
  version: number;
  id: string;
  startUrl: string;
  verified: boolean;
  description?: string;
  relatedLinks: MiniAppLink[];
  noticeBanner?: MiniAppNoticeBanner;
  /** WHY: a field the server omits or garbles is `DEFAULT_SHELL`'s. */
  shell: MiniAppShell;
}

export interface MiniAppFeedEntry {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  /** WHY: an open string; the reader decides which action types it can run. */
  actionType?: string;
  actionValue?: string;
}
