/** CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.8 leaves sorting to the client. */

import type { Campus } from '@skkuverse/shared';
import type { MapChipList, MapLayerDef } from '../map-config.types';
import type { MapOverlay } from '../overlay.types';
import { isLayerVisible, type LayerVisibilityInputs } from '../layers.rules';

export interface VisibleOverlaysInput {
  markers: readonly MapOverlay[];
  layers: readonly MapLayerDef[];
  state: LayerVisibilityInputs;
  /** WHY: the same clock the render loop used, so a list computed across 18:00 never disagrees with the pins. */
  now: number;
}

/**
 * WHY: a place is listed exactly when its layer is drawn, even when a coordinate collision hides its pin.
 * An inert overlay or one whose tap runs a chip has nowhere to go, so it is not a row.
 */
export function selectVisibleOverlays({
  markers,
  layers,
  state,
  now,
}: VisibleOverlaysInput): MapOverlay[] {
  const visible = new Set<string>();
  for (const layer of layers) {
    if (isLayerVisible(layer, state, now)) visible.add(layer.id);
  }
  if (visible.size === 0) return [];
  return markers.filter(
    (m) => m.tap !== null && m.tap.kind !== 'chip' && visible.has(m.layerId),
  );
}

export interface EventListShownInput {
  chipServed: boolean;
  overlays: readonly MapOverlay[];
  listed: readonly MapOverlay[];
  campus: Campus;
}

/**
 * WHY: only with a row, since some chip layers hold nothing tappable. `listed` is taken before the facets, so a
 * facet that empties the rows keeps the list and its filters. Only on the event's campus, which the first
 * overlay answers, as an activation is single-campus.
 */
export function isEventListShown({ chipServed, overlays, listed, campus }: EventListShownInput): boolean {
  return chipServed && listed.length > 0 && overlays[0]?.campus === campus;
}

/** WHY: ties fall through to `id`; the input is re-derived on every clock boundary, so a tie would reshuffle. */
export function sortPlaces(markers: readonly MapOverlay[]): MapOverlay[] {
  return [...markers].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

//

/** WHY: holding every option of an `optional` facet is "no filter", which is where a list opens. */
export type FacetSelection = Readonly<Record<string, readonly string[]>>;

/** WHY: a `required` facet opens on the option on now, else the nearest still to come, else the last. */
export function defaultFacetSelection(list: MapChipList, now: number): FacetSelection {
  const out: Record<string, readonly string[]> = {};
  for (const facet of list.facets) {
    if (facet.select === 'optional') {
      out[facet.id] = facet.options.map((o) => o.id);
      continue;
    }
    const timed = facet.options.flatMap((option) =>
      option.window
        ? [{ id: option.id, start: Date.parse(option.window.startAt), end: Date.parse(option.window.endAt) }]
        : [],
    );
    const current = timed.find((o) => now >= o.start && now < o.end);
    const next = [...timed].filter((o) => o.start > now).sort((a, b) => a.start - b.start)[0];
    const last = [...timed].sort((a, b) => b.end - a.end)[0];
    const pick = (current ?? next ?? last)?.id ?? facet.options[0]?.id;
    out[facet.id] = pick ? [pick] : [];
  }
  return out;
}

export function isWholeFacet(facet: MapChipList['facets'][number], held: readonly string[] | undefined): boolean {
  return held !== undefined && facet.options.every((o) => held.includes(o.id));
}

/** WHY: "nothing selected" never exists, so no tap has to be refused; kept in the server's option order. */
export function toggleChecklist(
  facet: MapChipList['facets'][number],
  held: readonly string[],
  optionId: string | null,
): readonly string[] {
  const all = facet.options.map((o) => o.id);
  if (optionId === null) return all;
  if (isWholeFacet(facet, held)) return [optionId];
  const toggled = held.includes(optionId) ? held.filter((id) => id !== optionId) : [...held, optionId];
  return toggled.length === 0 ? all : all.filter((id) => toggled.includes(id));
}

export function isFacetNarrowed(facet: MapChipList['facets'][number], held: readonly string[]): boolean {
  return facet.select === 'required' || !isWholeFacet(facet, held);
}

/**
 * WHY: a facet holding every option filters nothing, so a place with no tag in it still shows. Membership is
 * the served `facets`, never read off `hours`, where one stray date renumbered every place.
 */
export function filterByFacets(
  places: readonly MapOverlay[],
  list: MapChipList,
  selection: FacetSelection,
): MapOverlay[] {
  const active = list.facets.flatMap((facet) => {
    const held = selection[facet.id];
    if (!held || held.length === 0 || isWholeFacet(facet, held)) return [];
    return [[facet.id, held] as const];
  });
  if (active.length === 0) return [...places];
  return places.filter((place) =>
    active.every(([facetId, held]) => (place.facets[facetId] ?? []).some((o) => held.includes(o))),
  );
}

/**
 * WHY: ties fall through to `id`, as in `sortPlaces`. `title` sorts by code point: Hangul syllables are encoded
 * in dictionary order, so no `Intl` collator that Hermes might build differently per platform.
 */
export function sortForList(
  places: readonly MapOverlay[],
  list: MapChipList,
  selection: FacetSelection,
): MapOverlay[] {
  const byId = (a: MapOverlay, b: MapOverlay) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (list.sort.key === 'title') {
    return [...places].sort((a, b) =>
      a.text.ko !== b.text.ko ? (a.text.ko < b.text.ko ? -1 : 1) : byId(a, b),
    );
  }
  const scope = list.sort.scopeFacetId;
  const held = scope ? (selection[scope] ?? []) : [];
  if (!scope || held.length === 0) {
    return [...places].sort((a, b) => a.order - b.order || byId(a, b));
  }
  const rankOf = (p: MapOverlay): [number, number] => {
    const mine = p.facets[scope] ?? [];
    const at = held.findIndex((o) => mine.includes(o));
    if (at < 0) return [held.length, p.order];
    return [at, p.orderByOption[held[at]!] ?? p.order];
  };
  return [...places].sort((a, b) => {
    const [ga, oa] = rankOf(a);
    const [gb, ob] = rankOf(b);
    return ga - gb || oa - ob || byId(a, b);
  });
}
