/**
 * WHY: the prefixed form is the two fields of a marker's `tap`, so a shared link never disagrees with
 * its marker; the bare form is already in circulation and stays valid.
 */
export interface MapPlaceRef {
  /** WHY: null for a bare id, which resolves as an event place. */
  kind: PlaceKind | null;
  placeId: string;
  /** WHY: a caller that knows the room, not a parsed link; the grammar has no room, so a link never carries one. */
  highlightSpaceCd?: string;
}

// WHY: both anchors are what stop `../../etc` from passing as a place id.
const PLACE_REF_RE = /^(?:([a-z0-9_]+):)?([a-z0-9-]+)$/;

// WHY: an unknown prefix, from a newer build, drops the reference rather than keeping its id:
// guessing the kind is how a booth link opens the wrong building.
const PLACE_KINDS = ['skku_building', 'event', 'bus_stop', 'subway_station'] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

export function parseMapPlaceRef(value: unknown): MapPlaceRef | null {
  // WHY: refused before matching: `$` without the `m` flag still matches before a trailing newline.
  if (typeof value !== 'string' || /\s/.test(value)) return null;
  const match = PLACE_REF_RE.exec(value);
  const rawKind = match?.[1];
  const placeId = match?.[2];
  if (!placeId) return null;
  if (rawKind === undefined) return { kind: null, placeId };
  const kind = PLACE_KINDS.find((k) => k === rawKind);
  return kind ? { kind, placeId } : null;
}
