import type { TransitSheetRequest } from '@/features/transit/transit.types';
import type { EntrySource } from '@/platform/analytics.rules';
import type { CampusSuggestion, DismissedSuggestionKey } from './campus-proximity.types';
import type { LayerLens } from './map-config.types';
import type { MapOverlay } from './overlay.types';
import type { MapDetent } from './sheet-detents.constants';
import type { TaskOverlayRole } from './sheet-stack.constants';

export type PlaceSource = Extract<
  EntrySource,
  'pin' | 'zone' | 'path' | 'list' | 'deeplink' | 'miniapp' | 'webview' | 'sdui' | 'place_sheet' | 'other'
>;

export type MapPlaceSheetRequest =
  /** WHY: `source` is for `view_open`; it is not part of what makes two requests one sheet. */
  | {
      kind: 'skku_building';
      placeId: string;
      highlightSpaceCd: string | null;
      source: EntrySource;
    }
  | { kind: 'event'; placeId: string; source: PlaceSource; area?: boolean }
  /** WHY: written once at push. */
  | { kind: 'chip'; chipId: string };

export type MapSheetRequest = MapPlaceSheetRequest | TransitSheetRequest;
export type MapSheetKind = MapSheetRequest['kind'];
export type MapSheetRequestOf<K extends MapSheetKind> = Extract<MapSheetRequest, { kind: K }>;

export interface MapCameraSnapshot {
  latitude: number;
  longitude: number;
  zoom: number;
  tilt: number;
  bearing: number;
}

/** WHY: only the top entry's view mounts; the rest are data. */
export interface MapSheetEntry {
  id: number;
  request: MapSheetRequest;
  key: string;
  layers: LayerLens;
  detent: MapDetent;
  /** WHY: any settle stamps it, a padding change's included, so it never says whether the sheet framed. */
  camera: MapCameraSnapshot | null;
  /** WHY: a view mounted again over the entry leaves the camera to the restore instead of framing anew. */
  framed: boolean;
  /** WHY: dropped when the user leaves the tab (`dropOrigins`), so a return never crosses a tab switch. */
  origin?: PageOrigin;
}

export interface PageOrigin {
  href: string;
  params: Readonly<Record<string, string>>;
}

export interface MapTaskState {
  stack: readonly MapSheetEntry[];
  nextId: number;
  suggestion: CampusSuggestion | null;
  dismissedSuggestion: DismissedSuggestionKey | null;
}

export type MapSheetEntryOf<K extends MapSheetKind> = MapSheetEntry & { request: MapSheetRequestOf<K> };


/** WHY: a view publishes everything and never reasons about where the sheet rests (ADR 0022 d3). */
export type TaskOverlay = MapOverlay & {
  role: TaskOverlayRole;
  color?: string;
};

/** WHY: no close mark here; the one on screen is the sheet's (ADR 0022 d1). */
export interface TaskHeader {
  title: string;
}

export interface MapOverlayLens {
  overlays?: readonly TaskOverlay[];
  dimOthers?: boolean;
  hiddenIds?: ReadonlySet<string>;
  /** WHY: the lowest publisher wins, the task's root context. */
  header?: TaskHeader;
}
