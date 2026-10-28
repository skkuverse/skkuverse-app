// CONTRACT(skkuverse-server): skkuverse-server/src/bus/ writes the bus config; its produced
// fixtures are the bus-config fixtures this feature's suites read.
import { z } from 'zod';
import { finiteNumber, openEnum, openUnionArray, optionalText, parsedBy, text, tolerantArray } from '@skkuverse/shared';
import {
  integerSchema,
  latLngSchema,
  optionalStringSchema,
  servedList,
  wholeList,
  type ServedList,
} from './transit.schema';
import type {
  BoardingStop,
  BusGroup,
  BusGroupVisibility,
  BusService,
  RealtimeDirection,
  RealtimeScreenConfig,
  RealtimeStation,
  RefreshTarget,
  RouteBadge,
  ScheduleScreenConfig,
  SequenceStop,
  ServiceRefresh,
  StopMap,
  StopMapMarker,
  StopMapPath,
  TransferLine,
} from './transit.types';

const visibilitySchema = z
  .object({ type: z.literal('dateRange'), from: z.string(), until: z.string() })
  .transform(({ from, until }): BusGroupVisibility => ({ type: 'dateRange', from, until }))
  .catch({ type: 'always' });

const cardTextSchema = z.string().catch('');

/** WHY: a card is decoration, so a missing or broken one reads as empty rather than failing the group. */
const cardSchema = z
  .object({ themeColor: cardTextSchema, iconType: cardTextSchema, busTypeText: cardTextSchema })
  .catch({ themeColor: '', iconType: '', busTypeText: '' });

// WHY: a `features` that is not a list reads as none rather than failing the whole group; each
// feature is handed on as served.
const featuresSchema = tolerantArray(
  z.custom<Record<string, unknown>>((raw) => raw !== null && typeof raw === 'object'),
  'bus.features',
).catch([]);

const transferLineSchema = z.object({ line: z.string(), color: z.string() }) satisfies z.ZodType<TransferLine>;

const TRANSFER_LINES: ServedList = { where: 'bus.transferLines' };

const realtimeStationSchema = z
  .object({
    index: finiteNumber,
    name: z.string(),
    subtitle: optionalStringSchema,
    stationNumber: optionalStringSchema,
    directionId: optionalText,
    isFirstStation: z.boolean().catch(false),
    isLastStation: z.boolean().catch(false),
    isRotationStation: z.boolean().catch(false),
    // WHY: only a served true marks a pass; a server before the field, or any other value, reads as a stop.
    isPassThrough: z.boolean().catch(false),
    // WHY: the same for drop-off-only, so a server without the flag lets riders board everywhere.
    isAlightOnly: z.boolean().catch(false),
    stopId: optionalText,
    transferLines: servedList(transferLineSchema, TRANSFER_LINES),
  })
  .transform(
    ({ subtitle, stationNumber, directionId, stopId, ...station }) =>
      ({
        ...station,
        ...(subtitle !== undefined && { subtitle }),
        ...(stationNumber !== undefined && { stationNumber }),
        ...(directionId && { directionId }),
        ...(stopId && { stopId }),
      }) satisfies RealtimeStation,
  );

/** WHY: a direction with any part missing is dropped alone, since a tab with no range would list no station. */
const realtimeDirectionSchema = z.object({
  id: text,
  label: text,
  fromIndex: integerSchema,
  toIndex: integerSchema,
}) satisfies z.ZodType<RealtimeDirection>;

const realtimeScreenSchema = z
  .object({
    stations: servedList(realtimeStationSchema, { where: 'bus.stations' }),
    liveEndpoint: optionalText,
    directions: servedList(realtimeDirectionSchema, { where: 'bus.directions' }),
    refreshInterval: finiteNumber.catch(15),
    lastStationIndex: finiteNumber.optional().catch(undefined),
    isLoop: z.boolean().catch(false),
    capabilities: z
      .object({ plateNumber: z.boolean().catch(true), lowFloor: z.boolean().catch(false) })
      .catch({ plateNumber: true, lowFloor: false }),
    features: featuresSchema,
  })
  .transform(
    ({ liveEndpoint, lastStationIndex, capabilities, ...screen }) =>
      ({
        ...(liveEndpoint && { liveEndpoint }),
        ...screen,
        lastStationIndex: lastStationIndex ?? Math.max(0, screen.stations.length - 1),
        hasPlates: capabilities.plateNumber,
        hasLowFloor: capabilities.lowFloor,
      }) satisfies RealtimeScreenConfig,
  );

// WHY: the boarding fields (`serviceSelector`, `stops`, `stopSequences`, `stopTimes`) are optional and
// read strictly, so a malformed part drops alone and a bad stop costs its own row, never the screen.

// QUIRK(skkuverse-server): a marker's and a path's `kind` is an open enum with kinds reserved for a
// later build, so an unknown one drops that element alone, never the map.
const stopMapMarkerSchemas = {
  subwayExit: z
    .object({ id: text, label: text, number: integerSchema, coords: latLngSchema })
    .transform((marker) => ({ kind: 'subwayExit', ...marker }) satisfies StopMapMarker),
};

const stopMapPathSchemas = {
  walk: z
    .object({ from: text, to: text, points: wholeList(latLngSchema, 'bus.stopMap.points', 2) })
    .transform((path) => ({ kind: 'walk', ...path }) satisfies StopMapPath),
};

/** WHY: a path stays when the marker at one end was dropped; the walk is still where riders walk. */
const stopMapSchema = z.object({
  markers: openUnionArray('kind', stopMapMarkerSchemas, 'bus.stopMap.markers').catch([]),
  paths: openUnionArray('kind', stopMapPathSchemas, 'bus.stopMap.paths').catch([]),
}) satisfies z.ZodType<StopMap>;

const httpsUrlSchema = z.string().startsWith('https://').optional().catch(undefined);

const boardingStopSchema = z
  .object({
    id: text,
    name: text,
    detail: optionalText,
    coords: latLngSchema.optional().catch(undefined),
    photoUrl: httpsUrlSchema,
    streetViewUrl: httpsUrlSchema,
    map: stopMapSchema.optional().catch(undefined),
    /** WHY: a link needs both its target and its text, so either half missing drops the station. */
    subwayStation: z.object({ id: text, title: text }).optional().catch(undefined),
  })
  .transform(
    ({ detail, coords, photoUrl, streetViewUrl, map, subwayStation, ...stop }) =>
      ({
        ...stop,
        ...(detail && { detail }),
        ...(coords && { coords }),
        ...(photoUrl && { photoUrl }),
        ...(streetViewUrl && { streetViewUrl }),
        // WHY: the stop is always the card's pin, so a map without coords has nothing to centre on.
        ...(coords && map && { map }),
        ...(subwayStation && { subwayStation }),
      }) satisfies BoardingStop,
  );

const sequenceStopSchema = z
  .object({
    label: text,
    action: parsedBy((action) => (action === 'board' || action === 'alight' ? action : null)),
    // WHY: an unknown timing reads as estimated, since an estimated time never decides whether a
    // run is past, so a wrong guess cannot hide a bus.
    timing: openEnum(['scheduled', 'estimated'], 'estimated'),
    stopId: optionalText,
    detail: optionalText,
    note: optionalText,
  })
  .transform(
    ({ stopId, detail, note, ...stop }) =>
      ({ ...stop, ...(stopId && { stopId }), ...(detail && { detail }), ...(note && { note }) }) satisfies SequenceStop,
  );

/**
 * WHY: a sequence with an unreadable stop drops whole, never shortened, since an entry's `stopTimes`
 * index into it and a shorter list would pair each time with the wrong stop.
 */
const stopSequencesSchema = z
  .record(z.string(), wholeList(sequenceStopSchema, 'bus.stopSequences').optional().catch(undefined))
  .transform((sequences) => {
    const read = Object.entries(sequences).flatMap(([routeType, stops]) => (stops ? [[routeType, stops] as const] : []));
    return read.length > 0 ? Object.fromEntries(read) : undefined;
  })
  .catch(undefined);

const REFRESH_TARGETS: readonly RefreshTarget[] = ['traffic', 'crowding'];

/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/bus/eta/smart/bus-eta-smart.service.ts polls the
 * estimates every 60 s and serves them `max-age=60`, so asking more often gets the same answer.
 */
const DEFAULT_REFRESH_INTERVAL_SEC = 60;

/** WHY: a mistyped server value (a `1` meant as minutes) must not make every open screen poll each second. */
const MIN_REFRESH_INTERVAL_SEC = 15;

/** WHY: a refresh with no target this build knows is no refresh at all. */
const serviceRefreshSchema = z
  .object({
    targets: z
      .custom<unknown[]>(Array.isArray)
      .catch([])
      .transform((served) => REFRESH_TARGETS.filter((target) => served.includes(target))),
    intervalSec: z
      .number()
      .positive()
      .transform((sec) => Math.max(sec, MIN_REFRESH_INTERVAL_SEC))
      .catch(DEFAULT_REFRESH_INTERVAL_SEC),
  })
  .refine(({ targets }) => targets.length > 0)
  .optional()
  .catch(undefined) satisfies z.ZodType<ServiceRefresh | undefined>;

const busServiceSchema = z
  .object({
    serviceId: z.string(),
    label: z.string(),
    endpoint: z.string(),
    stopSequences: stopSequencesSchema,
    refresh: serviceRefreshSchema,
  })
  .transform(
    ({ stopSequences, refresh, ...service }) =>
      ({ ...service, ...(stopSequences && { stopSequences }), ...(refresh && { refresh }) }) satisfies BusService,
  );

const routeBadgeSchema = z.object({ id: z.string(), label: z.string(), color: z.string() }) satisfies z.ZodType<RouteBadge>;

/** WHY: a `stopId` the catalog does not have would link to no stop, so that sequence stop keeps its label alone. */
function linkedToCatalog(service: BusService, catalog: ReadonlySet<string>): BusService {
  if (!service.stopSequences) return service;
  const linked = Object.entries(service.stopSequences).map(([routeType, stops]) => [
    routeType,
    stops.map(({ stopId, ...stop }) => ({ ...stop, ...(stopId && catalog.has(stopId) && { stopId }) })),
  ]);
  return { ...service, stopSequences: Object.fromEntries(linked) };
}

const scheduleScreenSchema = z
  .object({
    stops: tolerantArray(boardingStopSchema, 'bus.stops').catch([]),
    services: servedList(busServiceSchema, { where: 'bus.services', keepsCache: true }),
    defaultServiceId: optionalStringSchema,
    serviceSelector: openEnum(['segmented', 'chips'], 'segmented'),
    routeBadges: servedList(routeBadgeSchema, { where: 'bus.routeBadges' }),
    features: featuresSchema,
  })
  .transform(({ stops, services, defaultServiceId, ...screen }) => {
    const catalog = new Set(stops.map((stop) => stop.id));
    const linked = services.map((service) => linkedToCatalog(service, catalog));
    const named = new Set(linked.flatMap((service) => Object.values(service.stopSequences ?? {}).flat()).flatMap((stop) => stop.stopId ?? []));
    return {
      ...screen,
      services: linked,
      ...(defaultServiceId !== undefined && { defaultServiceId }),
      stops: stops.filter((stop) => named.has(stop.id)),
    } satisfies ScheduleScreenConfig;
  });

/** WHY: only a missing screen fails the group; any other value reads its fields, and a list or a primitive has none. */
function screenOf<T extends z.ZodType>(screen: T) {
  return z.preprocess((raw) => (raw != null && (typeof raw !== 'object' || Array.isArray(raw)) ? {} : raw), screen);
}

const groupFields = { id: z.string(), label: z.string(), visibility: visibilitySchema, card: cardSchema };

export const busGroupSchema = z.union([
  z.object({ ...groupFields, screenType: z.literal('schedule'), screen: screenOf(scheduleScreenSchema) }),
  z.object({
    ...groupFields,
    // WHY: any type but `schedule` reads as realtime; this branch aborts on a schedule group, so a
    // broken schedule screen fails with its own reason rather than the union's.
    screenType: z
      .unknown()
      .optional()
      .refine((type) => type !== 'schedule', { abort: true })
      .transform(() => 'realtime' as const),
    screen: screenOf(realtimeScreenSchema),
  }),
]) satisfies z.ZodType<BusGroup>;
