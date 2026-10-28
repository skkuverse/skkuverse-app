export const FRESH_WINDOW_MS = 15 * 60_000;

export const FEED_LABEL_TICK_MS = 30_000;

// WHY: a poll only backs up the push path, which refetches at once (feed.service.ts).
export const FEED_HOME_REFETCH_MS = 30_000;
export const FEED_SCREEN_REFETCH_MS = 15_000;

export const FEED_REFOCUS_FRESH_MS = 5_000;

/** SEE: docs/reference/miniapp-notification-payload.md */
export function toFeedRoute(miniAppId: string): string {
  return `/miniapp-feed/${encodeURIComponent(miniAppId)}`;
}
