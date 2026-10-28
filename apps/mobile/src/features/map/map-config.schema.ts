// CONTRACT(skkuverse-server): skkuverse-server/src/map/ writes this shape and publishes its fixtures as
// map-config.mapConfig. WHY: lists are tolerant; a malformed item drops alone and is reported (ADR 0020 D6).
import { z } from 'zod';
import {
  CAMPUSES,
  openEnum,
  opt,
  optionalText,
  parseActionType,
  parseMiniAppTarget,
  text,
  toMinutesOfDay,
  tolerantArray,
} from '@skkuverse/shared';
import { DEFAULT_CAMERA_DEFAULTS, DEFAULT_NAVER_STYLE_ID, FALLBACK_CAMPUS } from './map.constants';
import { fieldBearingData, listOf, maybeNumber, maybeString, numberOr, required, requiredNumber, timestamp } from './map.schema';
import type {
  CampusDef,
  DailyWindow,
  LayerDefaultVisibility,
  MapCameraDefaults,
  MapCameraMotion,
  MapChip,
  MapChipAction,
  MapChipFacet,
  MapChipFacetOption,
  MapChipIcon,
  MapChipList,
  MapConfig,
  MapLayerDef,
  MapLayerStyle,
  MapTabId,
  NaverConfig,
  TimeWindow,
} from './map-config.types';

const MARKER_STYLES = ['numberCircle', 'numberDot', 'textLabel', 'placeDot'] as const;
/** WHY: an unknown shape reads as absent, which the client answers with its own default (`MapLayerStyle.shape`). */
const MARKER_SHAPES = ['pin', 'dot', 'dotThenPin'] as const;
const MAP_TAB_IDS = ['map', 'transit'] as const satisfies readonly MapTabId[];
const FACET_SELECTS = ['required', 'optional'] as const;

/** WHY: absent when unserved, so the readers apply the default; a tab from a newer build is left out. */
const tabsSchema = tolerantArray(openEnum(MAP_TAB_IDS), 'map.tabs')
  .transform((tabs) => tabs.filter((tab): tab is MapTabId => tab !== undefined))
  .optional()
  .catch(undefined);

const withTabs = (tabs: MapTabId[] | undefined) => (tabs ? { tabs } : {});

const naverSchema = z
  .object({ styleId: z.string().trim().min(1).catch(DEFAULT_NAVER_STYLE_ID) })
  .catch(() => ({ styleId: DEFAULT_NAVER_STYLE_ID })) satisfies z.ZodType<NaverConfig>;

/**
 * WHY: an unrecognised campus id drops it, since a default would draw a toggle for markers of another campus;
 * `radiusM` stays absent when unserved, so the client's fallback applies rather than 0 m.
 */
const campusSchema = z.object({
  id: required(openEnum(CAMPUSES)),
  label: z.string(),
  centerLat: requiredNumber,
  centerLng: requiredNumber,
  defaultZoom: numberOr(FALLBACK_CAMPUS.defaultZoom),
  defaultTilt: numberOr(0),
  defaultBearing: numberOr(0),
  radiusM: maybeNumber,
}) satisfies z.ZodType<CampusDef>;

const cameraMotion = (fallback: MapCameraMotion) =>
  z
    .object({
      zoom: numberOr(fallback.zoom),
      tilt: numberOr(fallback.tilt),
      bearing: numberOr(fallback.bearing),
      durationMs: numberOr(fallback.durationMs),
    })
    .catch(() => ({ ...fallback })) satisfies z.ZodType<MapCameraMotion>;

const { campusFocus: CAMPUS_FOCUS, markerFocus: MARKER_FOCUS } = DEFAULT_CAMERA_DEFAULTS;
const cameraDefaultsSchema = z
  .object({
    markerFocus: cameraMotion(MARKER_FOCUS),
    campusFocus: z
      .object({ durationMs: numberOr(CAMPUS_FOCUS.durationMs) })
      .catch(() => ({ durationMs: CAMPUS_FOCUS.durationMs })),
  })
  .catch(() => ({ markerFocus: { ...MARKER_FOCUS }, campusFocus: { durationMs: CAMPUS_FOCUS.durationMs } })) satisfies z.ZodType<MapCameraDefaults>;

const layerStyleSchema = z.object({
  color: maybeString,
  outlineColor: maybeString,
  outlineWidth: maybeNumber,
  fillOpacity: maybeNumber,
  minZoom: maybeNumber,
  maxZoom: maybeNumber,
  width: maybeNumber,
  height: maybeNumber,
  size: maybeNumber,
  captionTextSize: maybeNumber,
  zIndex: maybeNumber,
  shape: openEnum(MARKER_SHAPES),
}) satisfies z.ZodType<MapLayerStyle>;

/** WHY: equal bounds are ambiguous between nothing and all day, so they are no window. */
const dailyWindowSchema = z
  .object({ start: z.string(), end: z.string() })
  .refine(({ start, end }) => {
    const startMin = toMinutesOfDay(start);
    const endMin = toMinutesOfDay(end);
    return startMin !== null && endMin !== null && startMin !== endMin;
  }) satisfies z.ZodType<DailyWindow>;

/**
 * WHY: unreadable resolves to off, so a kind from a newer server never draws a layer at the wrong hour.
 */
const defaultVisibleWhenSchema = z
  .union([
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
    z.object({
      kind: z.literal('scheduled'),
      windows: tolerantArray(dailyWindowSchema, 'map.layers.windows').refine((windows) => windows.length > 0),
    }),
  ])
  .nullable()
  .catch(null) satisfies z.ZodType<LayerDefaultVisibility | null>;

const layerSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    defaultVisibleWhen: defaultVisibleWhenSchema,
    endpoint: z.string(),
    markerStyle: openEnum(MARKER_STYLES),
    // WHY: only an explicit `false` locks the toggle. This governs an affordance, so it fails
    // open, the opposite of `defaultVisibleWhen`, which governs what is drawn.
    userConfigurable: z
      .unknown()
      .optional()
      .transform((value) => value !== false),
    // WHY: absent is `null`, the server's "no chip may change this layer", the safe direction.
    chipGroupId: optionalText.transform((id) => id ?? null),
    style: layerStyleSchema.optional().catch(undefined),
    tabs: tabsSchema,
  })
  .transform(({ tabs, ...layer }): MapLayerDef => ({ ...layer, ...withTabs(tabs) }));

/** WHY: an unrecognised icon degrades to text-only, a declared state, rather than dropping the chip. */
const chipIconSchema = z
  .object({ kind: z.literal('emoji'), emoji: text })
  .nullable()
  .catch(null) satisfies z.ZodType<MapChipIcon | null>;

/**
 * WHY: missing motion comes from the response's own `markerFocus`, never the bundled one. `|lat| <= 90` also
 * rejects a swapped pair, since Seoul's longitude is 126.97.
 */
const chipCameraSchema = z.object({
  lat: requiredNumber.refine((lat) => Math.abs(lat) <= 90),
  lng: requiredNumber.refine((lng) => Math.abs(lng) <= 180),
  zoom: maybeNumber,
  tilt: maybeNumber,
  bearing: maybeNumber,
  durationMs: maybeNumber,
});
type WireChipCamera = z.output<typeof chipCameraSchema>;

// WHY: a non-list drops the chip, since `[]` already spells the camera-only chip; an entry that
// is not an id is left out rather than dropping the chip over it.
const layerIdsSchema = tolerantArray(optionalText, 'map.chips.layerIds').transform((ids) =>
  ids.filter((id): id is string => id !== undefined),
);

/**
 * WHY: a chip is its action, so one this build cannot dispatch fails the parse; a button that does nothing
 * is worse than none.
 */
const chipActionSchema = z.union([
  z.object({ kind: z.literal('webview'), url: text }),
  z
    .object({
      kind: z.literal('link'),
      actionType: z.unknown().optional().transform(parseActionType),
      actionValue: text,
    })
    .refine(({ actionType }) => actionType !== 'unknown' && actionType !== 'content')
    .refine(({ actionType, actionValue }) => actionType !== 'miniapp' || parseMiniAppTarget(actionValue) !== null),
  z.object({ kind: z.literal('focus'), camera: chipCameraSchema, layerIds: layerIdsSchema }),
  // WHY: `null` is the declared "no move"; a camera that is there but names no position drops the chip.
  z.object({
    kind: z.literal('layers'),
    layerIds: layerIdsSchema,
    camera: chipCameraSchema.nullish().transform((camera) => camera ?? null),
  }),
]);

/** WHY: both bounds, unlike a place's hours, since "open on today" reads the end. */
const timeWindowSchema = z.object({ startAt: timestamp, endAt: timestamp }) satisfies z.ZodType<TimeWindow>;

/** WHY: a malformed window costs only the "open on today" default, so the option is kept. */
const facetOptionSchema = z.object({
  id: text,
  label: text,
  window: timeWindowSchema.nullable().catch(null),
}) satisfies z.ZodType<MapChipFacetOption>;

/** WHY: a facet with no option is dropped; a row with nothing to press is worse than none. */
const facetSchema = z.object({
  id: text,
  label: text,
  select: required(openEnum(FACET_SELECTS)),
  options: tolerantArray(facetOptionSchema, 'map.chips.options').refine((options) => options.length > 0),
}) satisfies z.ZodType<MapChipFacet>;

/** WHY: every failure degrades toward showing more, so a malformed list can reorder rows, never hide one. */
const chipListSchema = z
  .object({
    facets: tolerantArray(facetSchema, 'map.chips.facets').catch(() => []),
    sort: z
      .object({ key: z.unknown().optional(), scopeFacetId: z.unknown().optional() })
      .catch(() => ({ key: undefined, scopeFacetId: undefined })),
  })
  .transform(({ facets, sort }): MapChipList => {
    if (sort.key === 'title') return { facets, sort: { key: 'title', scopeFacetId: null } };
    const scope = sort.scopeFacetId;
    const scopeFacetId = typeof scope === 'string' && facets.some((f) => f.id === scope) ? scope : null;
    return { facets, sort: { key: 'order', scopeFacetId } };
  })
  .nullable()
  .catch(null);

const chipSchema = z
  .object({
    // WHY: a chip renders as its label, so one without an id or a label could only render blank.
    id: text,
    label: text,
    icon: chipIconSchema,
    action: chipActionSchema,
    // WHY: only an explicit `true` resets: taking a narrowing chip for a reset would drop the user's view.
    isReset: z
      .unknown()
      .optional()
      .transform((value) => value === true),
    list: chipListSchema,
    tabs: tabsSchema,
    // WHY: a chip whose home is a tab this build lacks would run in the wrong one, so it drops.
    opensIn: opt(required(openEnum(MAP_TAB_IDS))),
  })
  .transform(({ tabs, opensIn, ...chip }) => ({ ...chip, ...withTabs(tabs), ...(opensIn ? { opensIn } : {}) }));
type WireChip = z.output<typeof chipSchema>;

function withMotion(camera: WireChipCamera, focus: MapCameraMotion) {
  return {
    lat: camera.lat,
    lng: camera.lng,
    zoom: camera.zoom ?? focus.zoom,
    tilt: camera.tilt ?? focus.tilt,
    bearing: camera.bearing ?? focus.bearing,
    durationMs: camera.durationMs ?? focus.durationMs,
  };
}

function withMarkerFocus(chip: WireChip, focus: MapCameraMotion): MapChip {
  const { action } = chip;
  const resolved: MapChipAction =
    action.kind === 'focus'
      ? { ...action, camera: withMotion(action.camera, focus) }
      : action.kind === 'layers'
        ? { ...action, camera: action.camera && withMotion(action.camera, focus) }
        : action;
  return { ...chip, action: resolved };
}

const configFieldsSchema = z.object({
  naver: naverSchema,
  cameraDefaults: cameraDefaultsSchema,
  layers: listOf(layerSchema, 'map.layers'),
  campuses: listOf(campusSchema, 'map.campuses'),
  chips: listOf(chipSchema, 'map.chips'),
});

export const mapConfigSchema = fieldBearingData.transform((data, ctx): MapConfig => {
  const fields = configFieldsSchema.safeParse(data);
  if (!fields.success) {
    ctx.addIssue({ code: 'custom', message: 'map.layers, map.campuses or map.chips is not a list' });
    return z.NEVER;
  }
  const { naver, cameraDefaults, layers, campuses, chips } = fields.data;

  // WHY: a served list with no readable layer is a response this build cannot draw a map from, so
  // it fails, and the query keeps its last good copy or the hook applies DEFAULT_MAP_CONFIG. An
  // empty list is not one.
  const servedLayers = Array.isArray(data.layers) && data.layers.length > 0;
  if (servedLayers && layers.every((layer) => layer.defaultVisibleWhen === null)) {
    ctx.addIssue({ code: 'custom', message: 'map.layers has no readable layer' });
    return z.NEVER;
  }

  return {
    naver,
    campuses,
    layers,
    chips: chips.map((chip) => withMarkerFocus(chip, cameraDefaults.markerFocus)),
    cameraDefaults,
  };
});
