/** QUIRK(javascript): `setTimeout` overflows past this delay and fires at once. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** WHY: aligned to the wall clock's boundaries, not intervals from when the clock started. */
export function toAlignedEdge(now: number, everyMs: number): number | null {
  if (!Number.isFinite(everyMs) || everyMs <= 0) return null;
  return (Math.floor(now / everyMs) + 1) * everyMs;
}

/** WHY: capped, so a far edge is waited for in steps. */
export function toArmDelay(edge: number, now: number): number {
  return Math.min(Math.max(edge - now, 0), MAX_TIMER_DELAY_MS);
}
