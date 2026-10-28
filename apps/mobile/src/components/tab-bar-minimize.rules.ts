// WHY: derived from expo-glass-tabs 0.1.1's `useMinimizeOnScroll` (MIT, David Mokos,
// src/minimize-context.tsx:62-88); the notice is `apps/mobile/src/bootstrap/glass-tabs/LICENSE`.

export type MinimizeTarget = 0 | 1;
export const EXPANDED: MinimizeTarget = 0;
export const MINIMIZED: MinimizeTarget = 1;

export const TOP_ZONE = 24;

export const DIRECTION_DEADBAND = 3;

export interface ScrollSample {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
  // QUIRK(ios): under automatic inset adjustment a page's offset rests at minus its header's height,
  // which comes in here, or the raw offset starts negative and never leaves the top zone.
  topInset: number;
}

/** WHY: clamped to the scrollable range, so a rubber band never reads as a reversal. */
export function clampedScrollY({ offsetY, contentHeight, viewportHeight, topInset }: ScrollSample): number {
  'worklet';
  const maxY = Math.max(contentHeight - viewportHeight + topInset, 0);
  return Math.min(Math.max(offsetY + topInset, 0), maxY);
}

export function decideMinimize(y: number, dy: number): MinimizeTarget | null {
  'worklet';
  if (y < TOP_ZONE) return EXPANDED;
  if (dy > DIRECTION_DEADBAND) return MINIMIZED;
  if (dy < -DIRECTION_DEADBAND) return EXPANDED;
  return null;
}

/** WHY: expanded when a part-time scroller stops driving, since nothing else brings a minimized bar back. */
export function decideHandOver(wasDriving: boolean, drives: boolean): MinimizeTarget | null {
  'worklet';
  return wasDriving && !drives ? EXPANDED : null;
}
