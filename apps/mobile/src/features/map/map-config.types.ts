import type { ActionType, Campus } from '@skkuverse/shared';


export interface NaverConfig {
  styleId?: string;
}


export interface CampusDef {
  id: Campus;
  label: string; // WHY: server-driven display text, genuinely open
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  defaultTilt: number;
  defaultBearing: number;
  /**
   * WHY: optional on both sides: an older build falls back to `DEFAULT_CAMPUS_RADIUS_M` and an older server
   * sends nothing, so neither may assume the other has shipped.
   */
  radiusM?: number;
}


export interface MapLayerStyle {
  /**
   * WHY: bare hex with no `#` (`toCssColor`). One field paints a marker's tint, a path's stroke or a polygon's
   * fill, since a second field would be dead on every overlay a layer draws.
   */
  color?: string;
  outlineColor?: string;
  /** QUIRK(naver-map): `NaverMapPolygonOverlay` defaults it to zero, so an unstyled zone has no border. */
  outlineWidth?: number;
  /**
   * QUIRK(naver-map): the polygon `color` defaults to opaque black, so a zone without this hides its booths.
   * Kept apart from `color`, which the marker and path layers share.
   */
  fillOpacity?: number;
  /** WHY: a property of the layer: footprints are noise zoomed out, and boundary lines up close. */
  minZoom?: number;
  maxZoom?: number;
  width?: number;
  height?: number;
  size?: number;
  captionTextSize?: number;
  zIndex?: number;
  /**
   * WHY: absent means the client's `dotThenPin`. Not a `markerStyle` member, since an unknown `markerStyle`
   * falls through to the building-number branch, while an unknown `shape` reads as "not said".
   */
  shape?: MarkerShape;
}

export type MarkerShape = 'pin' | 'dot' | 'dotThenPin';

/**
 * WHY: wall-clock, not instants: "this layer belongs to the evening" holds on every festival day, while
 * instants would restate the dates in a second file. `start > end` wraps; midnight is only `"00:00"`.
 */
export interface DailyWindow {
  start: string;
  end: string;
}

export type LayerLens = Readonly<Record<string, boolean>>;

/**
 * WHY: a tagged union, so no contradictory boolean-plus-windows state exists. The device evaluates it
 * against its own clock, which keeps `/map/config` deterministic.
 */
export type LayerDefaultVisibility =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'scheduled'; windows: DailyWindow[] };

export interface MapLayerDef {
  id: string;
  label: string;
  /**
   * WHY: `null` is unreadable, a third state apart from `never` (an authoring choice), so it can be counted;
   * it resolves to off (`defaultVisibleAt`).
   */
  defaultVisibleWhen: LayerDefaultVisibility | null;
  endpoint: string;
  /** WHY: no layer `type`: an overlay's own `kind` chooses its renderer, so one layer draws pins, a zone and a route. */
  markerStyle?: 'numberCircle' | 'numberDot' | 'textLabel' | 'placeDot';
  style?: MapLayerStyle;
  /**
   * WHY: absent means `true`, never fail closed, so an older server cannot lock every control. It governs the
   * affordance only; a locked layer still renders, fetches and deep-links.
   */
  userConfigurable?: boolean;
  /**
   * WHY: `null` means no chip may change the layer, the safe default for an older server. Declared, never
   * inferred from `endpoint`, which is a cache key.
   */
  chipGroupId: string | null;
  /** WHY: absent means `['map']`, what every layer meant before the field (ADR 0022). */
  tabs?: readonly MapTabId[];
}


/** WHY: the SDK cannot honour all four at once; `camera-move.rules.ts` picks the mechanism. */
export interface MapCameraMotion {
  zoom: number;
  tilt: number;
  bearing: number;
  durationMs: number;
}

export interface MapChipCamera extends MapCameraMotion {
  lat: number;
  lng: number;
}

/** WHY: tagged, so a second icon kind arrives without growing a field. */
export type MapChipIcon = { kind: 'emoji'; emoji: string };

/** WHY: an action and a layer set, not the home SDUI's flat pair, which cannot carry a camera. */
export type MapChipAction =
  | { kind: 'webview'; url: string }
  /** WHY: a permanent link chip moves no camera and narrows nothing, so it never becomes the active chip. */
  | { kind: 'link'; actionType: ActionType; actionValue: string }
  | {
      kind: 'focus';
      camera: MapChipCamera;
      /**
       * WHY: "within this group, set exactly these", not "turn these on". `[]` is the camera-only chip, so this is
       * not nullable (`chips.rules.ts`).
       */
      layerIds: string[];
    }
  /**
   * WHY: no group resolution, since a `chipGroupId` on the route layers reads as festival content to installed
   * builds; installed builds drop the whole chip (ADR 0022 d1).
   */
  | {
      kind: 'layers';
      layerIds: string[];
      camera: MapChipCamera | null;
    };

export interface MapChip {
  id: string;
  label: string;
  /** WHY: nullable before it is reachable, since widening a non-nullable field later breaks older clients. */
  icon: MapChipIcon | null;
  action: MapChipAction;
  /**
   * WHY: on the wire because a reset chip is no longer derivable once defaults move with the clock; read as
   * ordinary narrowing it would turn every evening layer on at noon.
   */
  isReset: boolean;
  /**
   * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.8. The server decides
   * membership per day; the app never works a day out from a date.
   */
  list: MapChipList | null;
  /** WHY: absent means `['map']`, what installed builds do. */
  tabs?: readonly MapTabId[];
  /** WHY: absent means the tab it was tapped in. */
  opensIn?: MapTabId;
}

export interface MapChipFacetOption {
  id: string;
  label: string;
  /** WHY: read only to open a `required` facet on the option containing now; membership rides on `facets`. */
  window: TimeWindow | null;
}

export type MapChipFacetSelect = 'required' | 'optional';

export interface MapChipFacet {
  id: string;
  label: string;
  select: MapChipFacetSelect;
  options: MapChipFacetOption[];
}

/** WHY: `title` sorts by code point, which is dictionary order for Hangul syllables. */
export type MapListSort =
  | { key: 'order'; scopeFacetId: string | null }
  | { key: 'title'; scopeFacetId: null };

export interface MapChipList {
  facets: MapChipFacet[];
  sort: MapListSort;
}

export interface MapCameraDefaults {
  /** WHY: tilt and bearing come from the place's campus, so these two apply only to an unknown campus. */
  markerFocus: MapCameraMotion;
  /** WHY: zoom, tilt and bearing are per campus, on `CampusDef`. */
  campusFocus: { durationMs: number };
}


export interface MapConfig {
  naver: NaverConfig;
  campuses: CampusDef[];
  layers: MapLayerDef[];
  /** WHY: chips ride in this document, so a chip's `layerIds` can never disagree with the layer list. */
  chips: MapChip[];
  cameraDefaults: MapCameraDefaults;
}


/** WHY: the map tab's route is `campus`; the two names meet once, at the router boundary. */
export type MapTabId = 'map' | 'transit';

/** WHY: both bounds are real, unlike `OpeningWindow`, whose end may be unannounced. */
export interface TimeWindow {
  startAt: string;
  endAt: string;
}
