// SEE: docs/explanation/miniapp-shell.md ("The iOS back swipe: the WebView's frame stays put")

export function stableHeaderHeight(prev: number, reported: number, transitioning: boolean): number {
  const valid = Number.isFinite(reported) && reported > 0;
  if (prev > 0 && (transitioning || !valid)) return prev;
  return valid ? reported : prev;
}

export const RESTORE_MIN_OFFSET = 50;

/**
 * WHY: only a real collapse, under half of where it was, so a page that scrolled itself or rubber-banded is left
 * be.
 */
export function scrollToRestore(before: number, after: number): number | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before < RESTORE_MIN_OFFSET) return null;
  if (after >= before / 2) return null;
  return Math.round(before);
}
