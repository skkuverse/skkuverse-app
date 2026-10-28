/**
 * WHY: two sheets never stack. A settled report lags every animation, so "down" is read from the live index;
 * `restoreTo` survives a nested request so the sheet returns where the user left it. Import-free for `node --test`.
 */

import type { MapDetent } from './sheet-detents.constants';

export interface SheetHandoff {
  level: MapDetent | 'closed';
  restoreTo: MapDetent | null;
  waiting: boolean;
}

export const IDLE_HANDOFF: SheetHandoff = { level: 'min', restoreTo: null, waiting: false };

/** WHY: gorhom's closed index is exactly -1; the margin only absorbs float error. */
const CLOSED_INDEX = -1 + 1e-3;

export function isClosedAt(liveIndex: number): boolean {
  return liveIndex <= CLOSED_INDEX;
}

/** WHY: never both `close` and `present`; a sheet caught mid-rise is closed again and the modal waits. */
export function requestHandoff(
  s: SheetHandoff,
  live: { closed: boolean; nearest: MapDetent },
): {
  state: SheetHandoff;
  close: boolean;
  present: boolean;
} {
  if (live.closed) {
    return { state: { ...s, waiting: false }, close: false, present: true };
  }
  // WHY: a settled close under a visibly raised sheet is a lagging report; the nearest level is the restore point.
  const current = s.level !== 'closed' ? s.level : live.nearest;
  return {
    state: { ...s, restoreTo: s.restoreTo ?? current, waiting: true },
    close: true,
    present: false,
  };
}


/** WHY: only the closed report releases a waiting modal, once, since the wait is cleared with it. */
export function sheetSettled(
  s: SheetHandoff,
  level: MapDetent | 'closed',
): { state: SheetHandoff; present: boolean } {
  const present = level === 'closed' && s.waiting;
  return { state: { ...s, level, waiting: present ? false : s.waiting }, present };
}

/**
 * WHY: a sheet the user left alone must not jump, and a waiting modal is dropped so a cancelled hand-off presents
 * nothing; recorded at `snapTo` at once, so a request mid-rise remembers the target.
 */
export function releaseHandoff(s: SheetHandoff): {
  state: SheetHandoff;
  snapTo: MapDetent | null;
} {
  const snapTo = s.restoreTo;
  return {
    state: { level: snapTo ?? s.level, restoreTo: null, waiting: false },
    snapTo,
  };
}
