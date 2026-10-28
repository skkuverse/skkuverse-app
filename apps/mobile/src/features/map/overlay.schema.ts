// CONTRACT(skkuverse-server): skkuverse-server/src/map/ writes this shape and publishes its fixtures as
// map.mapOverlays. WHY: lists are tolerant; a malformed item drops alone and is reported (ADR 0020 D6).
import { z } from 'zod';
import { CAMPUSES, openEnum, openUnionArray, parseActionType, parseMiniAppTarget, text, tolerantArray } from '@skkuverse/shared';
import { toLatLng, toLatLngs, toRings } from './geometry.rules';
import { fieldBearingData, i18nText, maybeNumber, numberOr, required, requiredI18n, timestamp } from './map.schema';
import type { MapOverlay, MarkerAction, MarkerField, MarkerTap, OpeningWindow } from './overlay.types';

const LOCATION_ACCURACIES = ['exact', 'area'] as const;
const ACTION_STYLES = ['primary', 'secondary'] as const;

/**
 * WHY: a place whose every window drops lands on `[]`, which reads as always open: a typo shows a booth open,
 * never hides it.
 */
const openingWindowSchema = z.object({
  startAt: timestamp,
  endAt: timestamp.nullish().transform((end) => end ?? null),
  label: i18nText,
}) satisfies z.ZodType<OpeningWindow>;

/** WHY: a half-drawn row says nothing, so a row missing either half is dropped. */
const fieldSchema = z.object({ label: requiredI18n, value: requiredI18n }) satisfies z.ZodType<MarkerField>;

/** WHY: an unknown `actionType` reads as `unknown`, which the handler declines to open, rather than dropping. */
const actionSchema = z
  .object({
    id: text,
    label: requiredI18n,
    actionType: z.unknown().optional().transform(parseActionType),
    actionValue: text,
    style: openEnum(ACTION_STYLES),
  })
  .refine(({ actionType, actionValue }) => actionType !== 'miniapp' || parseMiniAppTarget(actionValue) !== null)
  .transform(({ style, ...action }): MarkerAction => ({ ...action, ...(style ? { style } : {}) }));

/** WHY: `null` leaves the marker drawn but inert: a place we cannot route is still worth drawing. */
const tapSchema = z
  .union([
    z.object({ kind: z.literal('chip'), chipId: text }),
    z.object({ kind: z.union([z.literal('skku_building'), z.literal('event')]), placeId: text }),
  ])
  .nullable()
  .catch(null) satisfies z.ZodType<MarkerTap | null>;

const facetMembershipSchema = z
  .record(z.string(), z.unknown())
  .catch(() => ({}))
  .transform((membership) =>
    Object.fromEntries(
      Object.entries(membership).flatMap(([facetId, ids]) =>
        Array.isArray(ids) ? [[facetId, ids.filter((id): id is string => typeof id === 'string')]] : [],
      ),
    ),
  );

const orderByOptionSchema = z
  .record(z.string(), maybeNumber)
  .catch(() => ({}))
  .transform((orders) =>
    Object.fromEntries(Object.entries(orders).filter((entry): entry is [string, number] => entry[1] !== undefined)),
  );

/** WHY: without `layerId` an overlay cannot be told apart on a shared endpoint, so it is not drawn. */
const overlayBase = {
  id: text,
  layerId: text,
  campus: required(openEnum(CAMPUSES)),
  text: requiredI18n,
  subtitle: i18nText,
  hours: tolerantArray(openingWindowSchema, 'map.overlays.hours').catch(() => []),
  fields: tolerantArray(fieldSchema, 'map.overlays.fields').catch(() => []),
  actions: tolerantArray(actionSchema, 'map.overlays.actions').catch(() => []),
  // WHY: the last tiebreak in a collision; NaN would make every comparison false.
  order: numberOr(0),
  facets: facetMembershipSchema,
  orderByOption: orderByOptionSchema,
  // WHY: `null` is meaningful, a backdrop that is drawn and not pressable.
  tap: tapSchema,
};

/** WHY: the GeoJSON type is checked against `kind`, never trusted; a `marker` carrying a Polygon cannot be drawn. */
const geometry = <T>(type: string, read: (coordinates: unknown) => T | null) =>
  z.object({
    type: z.literal(type),
    coordinates: required<T>(z.unknown().optional().transform(read)),
  });

const markerSchema = z
  .object({
    ...overlayBase,
    kind: z.literal('marker'),
    geometry: geometry('Point', toLatLng),
    // WHY: 0 is a building's real value and the floor a booth never sits at.
    pinPriority: numberOr(0),
    // WHY: absent or unknown is the old behaviour, a pin at the place's own spot.
    locationAccuracy: openEnum(LOCATION_ACCURACIES, 'exact'),
  })
  .transform(({ geometry: { coordinates }, ...marker }): MapOverlay => ({ ...marker, ...coordinates }));

const polygonSchema = z
  .object({ ...overlayBase, kind: z.literal('polygon'), geometry: geometry('Polygon', toRings) })
  .transform(({ geometry: { coordinates }, ...zone }): MapOverlay => ({ ...zone, rings: coordinates }));

const pathSchema = z
  .object({ ...overlayBase, kind: z.literal('path'), geometry: geometry('LineString', (raw) => toLatLngs(raw, 2)) })
  .transform(({ geometry: { coordinates }, ...path }): MapOverlay => ({ ...path, line: coordinates }));

/**
 * WHY: the allowlist absorbs the open enum, so an unknown kind never reaches a renderer's switch, and a new kind
 * without its schema fails to compile.
 */
const OVERLAY_KINDS = { marker: markerSchema, polygon: polygonSchema, path: pathSchema } satisfies Record<
  MapOverlay['kind'],
  z.ZodType
>;

/**
 * WHY: `kind` is an open enum: an unknown kind is skipped silently, so the server ships a renderer without a
 * client release; neither it nor a malformed overlay touches its siblings.
 */
export const mapOverlaysSchema = fieldBearingData.transform((data, ctx): MapOverlay[] => {
  const overlays = openUnionArray('kind', OVERLAY_KINDS, 'map.overlays')
    .nullish()
    .safeParse(data.overlays);
  if (!overlays.success) {
    ctx.addIssue({ code: 'custom', message: 'map.overlays is not a list' });
    return z.NEVER;
  }
  return overlays.data ?? [];
});
