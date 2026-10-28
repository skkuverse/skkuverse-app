// CONTRACT(skkuverse-server): skkuverse-server/docs/reference/bus-stops-api.md keeps a route entry's
// `kind` an open enum, so an unknown kind is skipped and a malformed known one drops alone.
import { z } from 'zod';
import { openEnum, openUnionArray, parsedBy, parseI18nText, text, tolerantArray } from '@skkuverse/shared';
import { liveArrivalSchema, liveOperationSchema, liveVehicleSchema } from './live.schema';
import {
  campusSchema,
  envelopeMetaSchema,
  instantSchema,
  latLngSchema,
  nullableInstantSchema,
  nullableTextSchema,
  servedList,
  stationIndexSchema,
  type ServedList,
} from './transit.schema';
import type { BusStop, BusStopRoute, StopArrivals, StopRoute, TimetableRun } from './transit.types';

const i18nTextSchema = parsedBy(parseI18nText);

const stopActionSchema = openEnum(['board', 'alight'], 'board');

const nullableCoordsSchema = latLngSchema.nullable().catch(null);

const busStopRouteSchemas = {
  live: z
    .object({
      groupId: text,
      label: i18nTextSchema,
      stationIndex: stationIndexSchema,
      towards: i18nTextSchema.nullable().catch(null),
      action: stopActionSchema,
    })
    .transform((route) => ({ kind: 'live', ...route }) satisfies BusStopRoute),
  timetable: z
    .object({ groupId: text, label: i18nTextSchema, serviceId: text, routeType: text, action: stopActionSchema })
    .transform((route) => ({ kind: 'timetable', ...route }) satisfies BusStopRoute),
};

const busStopSchema = z.object({
  id: text,
  name: i18nTextSchema,
  coords: nullableCoordsSchema,
  campus: campusSchema,
  routes: openUnionArray('kind', busStopRouteSchemas, 'bus.stops.routes'),
}) satisfies z.ZodType<BusStop>;

export const busStopsSchema = z
  .object({ stops: tolerantArray(busStopSchema, 'bus.stops') })
  .transform(({ stops }) => stops) satisfies z.ZodType<BusStop[]>;

const VEHICLES: ServedList = { where: 'bus.stop.vehicles' };
const ARRIVALS: ServedList = { where: 'bus.stop.arrivals' };
const RUNS: ServedList = { where: 'bus.stop.runs' };

const stopLiveRouteSchema = z
  .object({
    groupId: text,
    label: text,
    action: stopActionSchema,
    stationIndex: stationIndexSchema,
    towards: nullableTextSchema,
    direction: z.object({ id: text, label: text }).nullable().catch(null),
    operation: liveOperationSchema,
    updatedAt: nullableInstantSchema,
    vehicles: servedList(liveVehicleSchema, VEHICLES),
    arrivals: servedList(liveArrivalSchema, ARRIVALS),
  })
  .transform(({ updatedAt, ...route }) => ({ kind: 'live', ...route, updatedAtMs: updatedAt }) satisfies StopRoute);

// WHY: a run with no readable departure cannot be told from the others, so it is dropped; its time
// prefers the estimate over the timetable, and a departure over an arrival.
const timetableRunSchema = z
  .object({
    runDepartureAt: instantSchema,
    expectedDepartureAt: nullableInstantSchema,
    scheduledDepartureAt: nullableInstantSchema,
    expectedArrivalAt: nullableInstantSchema,
    scheduledArrivalAt: nullableInstantSchema,
    basis: openEnum(['timetable', 'estimate'], 'timetable'),
    isLastRun: z.boolean().catch(false),
  })
  .transform(
    (run) =>
      ({
        runDepartureAtMs: run.runDepartureAt,
        atMs: run.expectedDepartureAt ?? run.scheduledDepartureAt ?? run.expectedArrivalAt ?? run.scheduledArrivalAt,
        isEstimate: run.basis === 'estimate',
        isLastRun: run.isLastRun,
      }) satisfies TimetableRun,
  );

const stopTimetableRouteSchema = z
  .object({
    groupId: text,
    label: text,
    action: stopActionSchema,
    serviceId: text,
    routeType: text,
    operation: openEnum(['running', 'suspended', 'noData'], 'running'),
    arrivals: servedList(timetableRunSchema, RUNS),
  })
  .transform(({ arrivals, ...route }) => ({ kind: 'timetable', ...route, runs: arrivals }) satisfies StopRoute);

const stopRoutesSchema = z
  .custom<unknown[]>(Array.isArray)
  .catch([])
  .pipe(openUnionArray('kind', { live: stopLiveRouteSchema, timetable: stopTimetableRouteSchema }, 'bus.stop.routes'));

export const stopArrivalsSchema = z
  .object({
    meta: envelopeMetaSchema,
    data: z.object({
      stop: z.object({ id: text, name: text, coords: nullableCoordsSchema }),
      routes: stopRoutesSchema,
    }),
  })
  .transform(
    ({ meta, data }) => ({ ...data, ...(meta.serverNow !== null && { serverNowMs: meta.serverNow }) }) satisfies StopArrivals,
  );
