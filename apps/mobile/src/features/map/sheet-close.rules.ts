/**
 * WHY: a removal the app makes never navigates; only the user's own close of an entry a page opened pushes the
 * page back (ADR 0022 d7). The reducer stays free of navigation.
 */

import type { TabRoute } from '@skkuverse/shared';
import { topEntry, type MapTaskAction } from './map-task.rules';
import type { MapTaskState, PageOrigin } from './sheet-stack.types';

export type CloseTrigger =
  | { kind: 'close' }
  | { kind: 'back' }
  | { kind: 'cardDismiss'; id: number }
  | { kind: 'retap' }
  | { kind: 'linkArrival'; id?: number }
  | { kind: 'navigateAway'; id: number }
  | { kind: 'releaseChip' }
  | { kind: 'dataGone'; id: number };

export interface CloseDecision {
  action: MapTaskAction | null;
  returnTo: PageOrigin | null;
}

function originOf(task: MapTaskState, id?: number): PageOrigin | null {
  const entry = id === undefined ? topEntry(task) : task.stack.find((e) => e.id === id);
  return entry?.origin ?? null;
}

export function decideClose(task: MapTaskState, trigger: CloseTrigger): CloseDecision {
  switch (trigger.kind) {
    case 'close':
    case 'back':
      return { action: { type: 'pop' }, returnTo: originOf(task) };
    case 'cardDismiss':
      return { action: { type: 'dismiss', id: trigger.id }, returnTo: originOf(task, trigger.id) };
    case 'retap':
      return { action: { type: 'popToRoot' }, returnTo: null };
    case 'linkArrival':
      return { action: trigger.id === undefined ? { type: 'popToRoot' } : { type: 'dismiss', id: trigger.id }, returnTo: null };
    case 'navigateAway':
      return { action: null, returnTo: null };
    case 'releaseChip':
      return { action: { type: 'releaseChip' }, returnTo: null };
    case 'dataGone':
      return { action: { type: 'dismiss', id: trigger.id }, returnTo: null };
  }
}

/**
 * WHY: an origin lasts only while its tab stays in front; the tabs arriving from a page forget nothing, since
 * that is how the place arrives. Not a narrower rule for `select`, since a pin swapped in over the page's
 * place stands where it stood.
 */
export function forgetsOrigins(previous: TabRoute | null, next: TabRoute | null): boolean {
  return previous !== null && previous !== next;
}

/** WHY: `source: 'return'`, so the page pushed back logs no second open and can restore its view. */
export function toPageOrigin({ href, params }: PageOrigin): PageOrigin {
  return { href, params: { ...params, source: 'return' } };
}
