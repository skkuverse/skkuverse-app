// CONTRACT(skkuverse-server): skkuverse-server/src/building/ writes these shapes and publishes their
// fixtures as building-catalog.buildingDetail and building-search.buildingSearch{Data,Meta}.
// WHY: a malformed item in any list drops alone and is reported, never the whole list.
import { z } from 'zod';
import { CAMPUSES, openEnum, text, tolerantArray, type LocalizedText } from '@skkuverse/shared';
import { toLatLng } from '../geometry.rules';
import { listOf, maybeNumber, maybeString, numberOr, requiredNumber } from '../map.schema';
import type {
  Accessibility,
  Building,
  BuildingConnection,
  BuildingDetail,
  BuildingImage,
  BuildingSearchResult,
  CampusCounts,
  FloorInfo,
  FloorSpace,
  SearchCounts,
  SearchSpaceItem,
  SpaceGroup,
} from './building.types';

const stringOrEmpty = z.string().catch('');

/** WHY: a value that is not an object reads as `{}`, so each field takes its own default. */
function orDefaults<S extends z.ZodObject>(shape: S) {
  return shape.catch(() => shape.parse({}));
}

/** WHY: an empty string, like `null`, means the server sent none; any other value goes to `schema`. */
function noneIfFalsy<S extends z.ZodType>(schema: S) {
  return z.union([z.literal(['', 0, false]).nullish().transform(() => undefined), schema]);
}

const localizedText = orDefaults(
  z.object({ ko: stringOrEmpty, en: stringOrEmpty }),
) satisfies z.ZodType<LocalizedText>;

const imageSchema = z.object({ url: text, filename: stringOrEmpty }) satisfies z.ZodType<BuildingImage>;

const accessibilitySchema = orDefaults(
  z.object({ elevator: z.boolean().catch(false), toilet: z.boolean().catch(false) }),
) satisfies z.ZodType<Accessibility>;

// WHY: a building with no readable position stays listed at (0, 0), which the camera never frames.
const NO_POSITION = { lat: 0, lng: 0 };

const buildingSchema = z
  .object({
    _id: requiredNumber,
    buildNo: maybeString,
    displayNo: maybeString,
    type: z.string().catch('building'),
    campus: openEnum(CAMPUSES, 'hssc'),
    campusLabel: stringOrEmpty,
    name: localizedText,
    description: noneIfFalsy(localizedText),
    location: z.object({ coordinates: z.unknown().optional().transform(toLatLng) }).optional().catch(undefined),
    image: imageSchema.optional().catch(undefined),
    accessibility: noneIfFalsy(accessibilitySchema),
    attachments: tolerantArray(z.unknown(), 'building.attachments').catch(() => []),
  })
  .transform(
    ({ _id, location, ...building }): Building => ({
      skkuId: _id,
      ...building,
      ...(location?.coordinates ?? NO_POSITION),
    }),
  );

const floorSpaceSchema = z.object({
  spaceCd: stringOrEmpty,
  name: localizedText,
  conspaceCd: maybeString,
}) satisfies z.ZodType<FloorSpace>;

const floorSchema = z.object({
  floor: localizedText,
  spaces: listOf(floorSpaceSchema, 'building.floor.spaces'),
}) satisfies z.ZodType<FloorInfo>;

const connectionSchema = z.object({
  targetSkkuId: requiredNumber,
  targetBuildNo: maybeString,
  targetDisplayNo: maybeString,
  targetName: localizedText,
  fromFloor: localizedText,
  toFloor: localizedText,
}) satisfies z.ZodType<BuildingConnection>;

export const buildingDetailSchema = z.object({
  building: buildingSchema,
  floors: listOf(floorSchema, 'building.floors'),
  connections: listOf(connectionSchema, 'building.connections'),
}) satisfies z.ZodType<BuildingDetail>;

const searchSpaceItemSchema = z.object({
  spaceCd: stringOrEmpty,
  name: localizedText,
  floor: localizedText,
}) satisfies z.ZodType<SearchSpaceItem>;

const spaceGroupSchema = z.object({
  skkuId: maybeNumber,
  buildNo: stringOrEmpty,
  displayNo: maybeString,
  campus: openEnum(CAMPUSES).transform((campus) => campus ?? null),
  campusLabel: stringOrEmpty,
  buildingName: localizedText,
  items: listOf(searchSpaceItemSchema, 'building.search.spaces.items'),
}) satisfies z.ZodType<SpaceGroup>;

const campusCountsSchema = orDefaults(z.object({ hssc: numberOr(0), nsc: numberOr(0), total: maybeNumber })).transform(
  ({ hssc, nsc, total }): CampusCounts => ({ hssc, nsc, total: total ?? hssc + nsc }),
);

const searchCountsSchema = orDefaults(
  z.object({ building: campusCountsSchema, space: campusCountsSchema }),
) satisfies z.ZodType<SearchCounts>;

export const buildingSearchSchema = z
  .object({
    meta: z.object({
      keyword: stringOrEmpty,
      buildingCount: numberOr(0),
      spaceCount: numberOr(0),
      counts: searchCountsSchema,
    }),
    data: z.object({
      buildings: listOf(buildingSchema, 'building.search.buildings'),
      spaces: listOf(spaceGroupSchema, 'building.search.spaces'),
    }),
  })
  .transform(({ meta, data }): BuildingSearchResult => ({ ...meta, ...data }));
