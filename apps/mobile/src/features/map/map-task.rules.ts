/**
 * WHY: an active chip is an entry, not a field beside the stack: a cross-tab chip pushes onto the target tab's
 * stack and back returns to what was under it (ADR 0022).
 */

import type { MapPlaceRef, PlaceKind } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import type { CampusSuggestion } from './campus-proximity.types';
import { placeSheetOpensTall } from './eventmap/place-detail.rules';
import { placeRequestSource, placeTapSource } from './entry-source.rules';
import { MAP_DETENT_RANK, type MapDetent } from './sheet-detents.constants';
import { SHEET_KIND_HOME_TAB } from './map-tabs.constants';
import type { LayerLens, MapTabId } from './map-config.types';
import type { FedPlaceKind, MapOverlay, MapPlace, MarkerTap } from './overlay.types';
import type {
  MapCameraSnapshot,
  MapSheetEntry,
  MapSheetEntryOf,
  MapSheetKind,
  MapPlaceSheetRequest,
  MapSheetRequest,
  MapTaskState,
  PageOrigin,
  PlaceSource,
} from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';

type Opening = { request: MapSheetRequest; key: string; layers: LayerLens; detent: MapDetent; origin?: PageOrigin };

export type MapTaskAction =
  | ({ type: 'push' } & Opening)
  | ({ type: 'select' } & Opening)
  | ({ type: 'open' } & Opening)
  | { type: 'pop' }
  | { type: 'popToRoot' }
  | { type: 'dismiss'; id: number }
  | { type: 'releaseChip' }
  | { type: 'dropOrigins' }
  | { type: 'setDetent'; detent: MapDetent }
  | { type: 'rememberCamera'; camera: MapCameraSnapshot }
  | { type: 'framed' }
  | { type: 'suggest'; suggestion: CampusSuggestion | null }
  | { type: 'dismissSuggestion' }
  | { type: 'resetSuggestion' };

export const EMPTY_TASK: MapTaskState = {
  stack: [],
  nextId: 0,
  suggestion: null,
  dismissedSuggestion: null,
};

function withTop(state: MapTaskState, change: (top: MapSheetEntry) => MapSheetEntry): MapTaskState {
  const top = topEntry(state);
  if (!top) return state;
  return { ...state, stack: [...state.stack.slice(0, -1), change(top)] };
}

function stacked(
  state: MapTaskState,
  below: readonly MapSheetEntry[],
  action: Extract<MapTaskAction, { type: 'push' | 'select' | 'open' }>,
  origin = action.origin,
): MapTaskState {
  const entry: MapSheetEntry = {
    id: state.nextId,
    request: action.request,
    key: action.key,
    layers: action.layers,
    detent: action.detent,
    camera: null,
    framed: false,
    ...(origin && { origin }),
  };
  return { ...state, stack: [...below, entry], nextId: state.nextId + 1 };
}

function withoutOrigin({ origin: _, ...entry }: MapSheetEntry): MapSheetEntry {
  return entry;
}

export function reduceMapTask(state: MapTaskState, action: MapTaskAction): MapTaskState {
  switch (action.type) {
    case 'push': {
      const top = topEntry(state);
      if (top?.key !== action.key) return stacked(state, state.stack, action);
      // WHY: a page asking for the sheet already on top makes that sheet the one its close returns from.
      const { origin } = action;
      return origin ? withTop(state, (entry) => ({ ...entry, origin })) : state;
    }
    case 'select': {
      // WHY: an identical top is replaced too, so re-tapping a chip starts its list over.
      const top = topEntry(state);
      if (!top || top.request.kind !== action.request.kind) return stacked(state, state.stack, action);
      // WHY: the replacing entry stands where the page's sheet stood, so its close still returns to the page.
      return stacked(state, state.stack.slice(0, -1), action, action.origin ?? top.origin);
    }
    case 'open':
      // WHY: an arrival from outside (a shared link, a push tap) is not the open sheet's context; a line linked over
      // a line would otherwise stack, and the task field would keep naming the line underneath.
      return stacked(state, [], action);
    case 'pop':
      return state.stack.length === 0 ? state : { ...state, stack: state.stack.slice(0, -1) };
    case 'popToRoot':
      return state.stack.length === 0 ? state : { ...state, stack: [] };
    case 'dismiss': {
      const stack = state.stack.filter((e) => e.id !== action.id);
      return stack.length === state.stack.length ? state : { ...state, stack };
    }
    case 'releaseChip': {
      const chip = activeChip(state);
      if (!chip) return state;
      return { ...state, stack: state.stack.filter((e) => e !== chip) };
    }
    case 'dropOrigins':
      if (!state.stack.some((entry) => entry.origin)) return state;
      return { ...state, stack: state.stack.map(withoutOrigin) };
    case 'setDetent':
      return withTop(state, (top) => ({ ...top, detent: action.detent }));
    case 'rememberCamera': {
      // WHY: follow mode settles on every GPS fix, often onto the recorded camera, so an unchanged task re-renders
      // nothing. Exact, not a tolerance: the record is what a restore puts back.
      const top = topEntry(state);
      if (top?.camera && sameCamera(top.camera, action.camera)) return state;
      return withTop(state, (entry) => ({ ...entry, camera: action.camera }));
    }
    case 'framed':
      return topEntry(state)?.framed ? state : withTop(state, (entry) => ({ ...entry, framed: true }));
    case 'suggest':
      // WHY: every camera settle re-derives an equal card; an unchanged task is
      // what keeps a settle from re-rendering the map's readers.
      if (sameSuggestion(state.suggestion, action.suggestion)) return state;
      return { ...state, suggestion: action.suggestion };
    case 'dismissSuggestion': {
      const { suggestion } = state;
      if (!suggestion) return state;
      return { ...state, suggestion: null, dismissedSuggestion: `${suggestion.campus}:${suggestion.variant}` };
    }
    case 'resetSuggestion':
      if (state.suggestion === null && state.dismissedSuggestion === null) return state;
      return { ...state, suggestion: null, dismissedSuggestion: null };
  }
}

function sameCamera(a: MapCameraSnapshot, b: MapCameraSnapshot): boolean {
  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.zoom === b.zoom &&
    a.tilt === b.tilt &&
    a.bearing === b.bearing
  );
}

function sameSuggestion(a: CampusSuggestion | null, b: CampusSuggestion | null): boolean {
  if (a === null || b === null) return a === b;
  return a.campus === b.campus && a.variant === b.variant && a.label === b.label;
}

export function topEntry(task: MapTaskState): MapSheetEntry | null {
  return task.stack.at(-1) ?? null;
}

function isKind<K extends MapSheetKind>(entry: MapSheetEntry, kind: K): entry is MapSheetEntryOf<K> {
  return entry.request.kind === kind;
}

export function topmostEntry<K extends MapSheetKind>(task: MapTaskState, kind: K): MapSheetEntryOf<K> | null {
  for (let i = task.stack.length - 1; i >= 0; i--) {
    const entry = task.stack[i];
    if (entry && isKind(entry, kind)) return entry;
  }
  return null;
}

export type MapChipEntry = MapSheetEntryOf<'chip'>;

export function activeChip(task: MapTaskState): MapChipEntry | null {
  return topmostEntry(task, 'chip');
}

/** WHY: per layer the highest entry wins, so a line's route stays drawn under a stop. */
export function topmostLayerLens(task: MapTaskState): LayerLens {
  return layerLensOf(task.stack.map((entry) => entry.layers));
}

export function layerLensOf(stackLayers: readonly LayerLens[]): LayerLens {
  const lens: Record<string, boolean> = {};
  for (const layers of stackLayers) Object.assign(lens, layers);
  return lens;
}

export function revealedCamera(task: MapTaskState): MapCameraSnapshot | null {
  return topEntry(task)?.camera ?? null;
}

export interface SeenTop {
  tab: MapTabId;
  top: number | 'root';
}

/** WHY: a tab switch records the new top and restores nothing; it moves only the sheet (ADR 0022 d3). */
export function cameraOnReveal(
  seen: SeenTop | null,
  tab: MapTabId,
  task: MapTaskState,
): { seen: SeenTop; restore: MapCameraSnapshot | null } {
  const now: SeenTop = { tab, top: topEntry(task)?.id ?? 'root' };
  const revealed = seen !== null && seen.tab === tab && seen.top !== now.top;
  return { seen: now, restore: revealed ? revealedCamera(task) : null };
}

export type BackDecision = { kind: 'collapse'; to: MapDetent } | { kind: 'pop' } | { kind: 'home' };

/**
 * WHY: under a screen reader a sheet opens at its top level and is never dragged, so back pops it at once
 * (ADR 0023 d3).
 */
export function decideBack(
  task: MapTaskState,
  initialDetentOf: (request: MapSheetRequest) => MapDetent,
  screenReader = false,
): BackDecision {
  const top = topEntry(task);
  if (!top) return { kind: 'home' };
  // WHY: back on a sheet a page opened goes back to the page, which collapsing first would hold up.
  if (screenReader || top.origin) return { kind: 'pop' };
  const initial = initialDetentOf(top.request);
  if (MAP_DETENT_RANK[top.detent] > MAP_DETENT_RANK[initial]) return { kind: 'collapse', to: initial };
  return { kind: 'pop' };
}

/** WHY: the word is for the analytics line; the call is the same either way. */
export function dismissAction(task: MapTaskState): 'back' | 'close' | 'return' {
  if (topEntry(task)?.origin) return 'return';
  return task.stack.length > 1 ? 'back' : 'close';
}

export function sheetTabFor(kind: MapSheetKind, beneath: MapTabId | null): MapTabId {
  return beneath ?? SHEET_KIND_HOME_TAB[kind];
}

export type LinkArrival = 'startOver' | 'onTop';

/**
 * WHY: only an arrival from outside the app starts the task over (ADR 0022 d7); one from inside opens on top, so
 * a chip's narrowing survives. A source this table does not name fails to compile.
 */
const LINK_ARRIVAL: Readonly<Record<EntrySource, LinkArrival>> = {
  deeplink: 'startOver',
  push: 'startOver',
  miniapp: 'startOver',
  webview: 'startOver',
  game: 'startOver',
  tab: 'onTop',
  home_banner: 'onTop',
  home_tile: 'onTop',
  home_feed: 'onTop',
  sdui: 'onTop',
  search: 'onTop',
  list: 'onTop',
  pin: 'onTop',
  zone: 'onTop',
  path: 'onTop',
  chip: 'onTop',
  place_sheet: 'onTop',
  building_sheet: 'onTop',
  line_sheet: 'onTop',
  hall_of_fame: 'onTop',
  schedule_boarding: 'onTop',
  schedule_transfer: 'onTop',
  route_detail: 'onTop',
  return: 'onTop',
  'promo:transit_top': 'onTop',
  'promo:miniapp_games': 'onTop',
  other: 'onTop',
};

/** WHY: on arrival, not as a later `open`, so the chip the same link names lands on the clean stack first. */
export function decideLinkArrival(source: EntrySource | undefined): LinkArrival {
  return source === undefined ? 'startOver' : LINK_ARRIVAL[source];
}

/** WHY: a place a page opened is pushed, so the user's sheet is still there after the return to the page. */
export function toLinkOpening(source: EntrySource | undefined, origin?: PageOrigin): 'open' | 'select' | 'push' {
  if (origin) return 'push';
  return decideLinkArrival(source) === 'startOver' ? 'open' : 'select';
}

export function toSheetRequest(
  link: MapPlaceRef & { source?: EntrySource },
  views: Partial<MapSheetViewTable>,
): MapSheetRequest | null {
  switch (link.kind) {
    // WHY: a bare id has only ever meant an event place.
    case null:
    case 'event':
      return { kind: 'event', placeId: link.placeId, source: placeRequestSource(link.source) };
    case 'skku_building':
      // WHY: `/building/:id` takes a number, while the grammar allows any `[a-z0-9-]+`.
      return Number.isFinite(Number(link.placeId))
        ? { kind: 'skku_building', placeId: link.placeId, highlightSpaceCd: null, source: placeRequestSource(link.source) }
        : null;
    default:
      return views[link.kind]?.fromPlace?.({ placeId: link.placeId, source: link.source ?? 'deeplink' }) ?? null;
  }
}

export function toPlaceRequest(place: MapOverlay, source: PlaceSource): MapSheetRequest {
  const placeId = place.tap && place.tap.kind !== 'chip' ? place.tap.placeId : place.id;
  return { kind: 'event', placeId, source, area: placeSheetOpensTall(place) };
}

export function toSheetRequestFromTap(
  tap: MarkerTap,
  placeOf: (placeId: string) => MapOverlay | undefined,
  views: Partial<MapSheetViewTable>,
): MapSheetRequest | null {
  switch (tap.kind) {
    case 'skku_building':
      return Number.isFinite(Number(tap.placeId))
        ? { kind: 'skku_building', placeId: tap.placeId, highlightSpaceCd: null, source: 'pin' }
        : null;
    case 'event': {
      const place = placeOf(tap.placeId);
      return place
        ? { kind: 'event', placeId: tap.placeId, source: placeTapSource(place.kind), area: placeSheetOpensTall(place) }
        : null;
    }
    case 'chip':
      return null;
    default:
      return views[tap.kind]?.fromPlace?.({ placeId: tap.placeId, source: 'pin', ...(tap.line && { line: tap.line }) }) ?? null;
  }
}

export function fedKindOf(kind: PlaceKind | null): FedPlaceKind | null {
  switch (kind) {
    case null:
    case 'event':
    case 'skku_building':
      return null;
    default:
      return kind;
  }
}

/** WHY: null while the feed has not answered, which is worth waiting for. */
export function fedPlaceLayers(
  places: ReadonlyMap<string, MapPlace> | undefined,
  id: string,
): LayerLens | null {
  if (!places) return null;
  return places.get(id)?.layers ?? {};
}

/** WHY: never the source or how it opens, so two ways to one place are one sheet. */
export function toMapSheetKey(request: MapPlaceSheetRequest): string {
  switch (request.kind) {
    case 'skku_building':
      return `skku_building:${request.placeId}:${request.highlightSpaceCd ?? ''}`;
    case 'event':
      return `event:${request.placeId}`;
    case 'chip':
      return `chip:${request.chipId}`;
  }
}
