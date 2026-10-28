import type { CampusDef, MapCameraDefaults, MapConfig, MapTabId } from './map-config.types';
/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/map/map.constants.ts `BASE_LAYERS` is what `layers` mirrors. Both
 * building layers share one endpoint, so two toggles cost one fetch; these are the only map URLs the app
 * hardcodes, so a server route change breaks the fallback only when the config call fails.
 */


/**
 * WHY: a copy of prod's `NAVER_MAP_STYLE_ID`, so a failed config keeps the look rather than the stock
 * basemap; the wire always wins, so update this when prod's value changes.
 */
export const DEFAULT_NAVER_STYLE_ID = '91a6fcf5-9d03-4762-99a5-7e58a5674628';

/**
 * WHY: one place, so the fallback and the wire agree; `mapConfigSchema` fills member by member, so a partial
 * object cannot produce a NaN zoom.
 */
export const DEFAULT_CAMERA_DEFAULTS: MapCameraDefaults = {
  markerFocus: { zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 },
  campusFocus: { durationMs: 500 },
};

export const FALLBACK_CAMPUS: CampusDef = {
  id: 'hssc',
  label: '인사캠',
  centerLat: 37.587241,
  centerLng: 126.992858,
  defaultZoom: 15.8,
  defaultTilt: 0,
  defaultBearing: 0,
};

export const DEFAULT_MAP_CONFIG: MapConfig = {
  naver: { styleId: DEFAULT_NAVER_STYLE_ID },
  campuses: [
    FALLBACK_CAMPUS,
    {
      id: 'nsc',
      label: '자과캠',
      centerLat: 37.29358,
      centerLng: 126.974942,
      defaultZoom: 15.8,
      defaultTilt: 0,
      // WHY: the campus grid runs ~6° east of north, so a camera turned by it squares the stadium to the screen.
      defaultBearing: 6,
    },
  ],
  layers: [
    {
      id: 'building_numbers',
      label: '건물번호',
      defaultVisibleWhen: { kind: 'always' },
      endpoint: '/map/overlays/campus',
      markerStyle: 'numberCircle',
      userConfigurable: true,
      chipGroupId: null,
    },
    {
      id: 'building_labels',
      label: '건물이름',
      defaultVisibleWhen: { kind: 'always' },
      endpoint: '/map/overlays/campus',
      markerStyle: 'textLabel',
      userConfigurable: true,
      chipGroupId: null,
    },
  ],
  // WHY: empty, since every served chip is a festival or a web page this fallback cannot know is still live.
  chips: [],
  cameraDefaults: DEFAULT_CAMERA_DEFAULTS,
};

/** WHY: `/map/config` never serves it; a sheet's lens alone puts overlays here. */
export const FOCUSED_PLACE_LAYER = 'transit_focus';

/**
 * EVIDENCE: the furthest of the 137 buildings sits 487 m from its campus centre and the centres are 32,692 m
 * apart, so 1000 m cannot overlap. WHY: kept after the server ships `radiusM`, since an installed build
 * meets servers with and without it.
 */
export const DEFAULT_CAMPUS_RADIUS_M = 1000;

export const DEFAULT_TABS: readonly MapTabId[] = ['map'];
