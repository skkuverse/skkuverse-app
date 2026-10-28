/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §3.4. WHY: openness outranks
 * `pinPriority`, since a spot is re-striped from booth to bar at dusk. Never apply this to the building layers,
 * which draw one building twice on purpose.
 */

import { isOpenNow, nextOpeningAfter } from './opening-hours.rules';
import type { OpeningWindow } from './overlay.types';

export interface PinCandidate {
  id: string;
  lat: number;
  lng: number;
  hours: OpeningWindow[];
  order: number;
  pinPriority: number;
}

/** WHY: six decimals is about 11 cm, finer than a surveyed two-stall split and coarser than JSON float noise. */
function coordKey(m: PinCandidate): string {
  return `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
}

/** WHY: a total order; the input is re-derived on every clock boundary, so a tie would swap a pin under the user. */
function beats(
  a: PinCandidate,
  b: PinCandidate,
  now: number,
  selectedId: string | null,
): boolean {
  // WHY: step 0: the sheet is open on the selected place and the camera flew there, so another occupant would
  // contradict it. At most one marker matches, so it cannot tie.
  //
  const aSel = selectedId !== null && a.id === selectedId;
  const bSel = selectedId !== null && b.id === selectedId;
  if (aSel !== bSel) return aSel;

  const aOpen = isOpenNow(a.hours, now);
  const bOpen = isOpenNow(b.hours, now);
  if (aOpen !== bOpen) return aOpen;

  if (a.pinPriority !== b.pinPriority) return a.pinPriority > b.pinPriority;

  // WHY: `null` is "never opens again", which loses to any real instant.
  const aNext = nextOpeningAfter(a.hours, now);
  const bNext = nextOpeningAfter(b.hours, now);
  if (aNext !== bNext) {
    if (aNext === null) return false;
    if (bNext === null) return true;
    return aNext < bNext;
  }

  if (a.order !== b.order) return a.order < b.order;
  return a.id < b.id;
}

/** WHY: input order is kept; the ladder ranks within a coordinate, and reordering the set would churn the tree. */
export function resolvePinCollisions<T extends PinCandidate>(
  markers: readonly T[],
  now: number,
  selectedId: string | null = null,
): T[] {
  const winners = new Map<string, T>();
  for (const m of markers) {
    const key = coordKey(m);
    const held = winners.get(key);
    if (held === undefined || beats(m, held, now, selectedId)) winners.set(key, m);
  }
  // WHY: identity, not id: an `id` repeats across layers.
  const drawn = new Set<T>(winners.values());
  return markers.filter((m) => drawn.has(m));
}
