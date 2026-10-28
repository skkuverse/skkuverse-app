/**
 * QUIRK(android): a screen the app itself puts up pauses the Activity, which React Native reports as
 * `background`, so the next `app_foreground` carries the kind as `handoff`, not as a user's return.
 */
export type HandoffKind =
  | 'permission'
  | 'sign_in'
  | 'ad'
  | 'browser'
  | 'external'
  | 'share'
  | 'settings'
  | 'review';

/**
 * QUIRK(ios): most hand-offs (a permission dialog, the in-app browser, the share sheet) never
 * background the app, so a mark has to expire; on Android each backgrounds it within a second.
 */
export const HANDOFF_WINDOW_MS = 5_000;

export interface HandoffMark {
  kind: HandoffKind;
  at: number;
}

export function handoffFor(mark: HandoffMark | null, backgroundedAt: number): HandoffKind | undefined {
  if (!mark) return undefined;
  const elapsed = backgroundedAt - mark.at;
  return elapsed >= 0 && elapsed <= HANDOFF_WINDOW_MS ? mark.kind : undefined;
}
