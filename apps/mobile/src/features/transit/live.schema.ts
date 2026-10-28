// CONTRACT(skkuverse-server): skkuverse-server/docs/reference/bus-live-api.md serves every key, null
// meaning unknown, and names each enum's fallback, which an unknown value here reads as.
import { z } from 'zod';
import { openEnum, text } from '@skkuverse/shared';
import {
  envelopeMetaSchema,
  instantSchema,
  integerSchema,
  nullableInstantSchema,
  nullableTextSchema,
  servedList,
  stationIndexSchema,
  wholeList,
  type ServedList,
} from './transit.schema';
import type { ArrivalStatus, LiveArrival, LiveGroup, LiveStation, LiveVehicle, TrajectoryKnot, VehiclePosition } from './transit.types';

export const liveOperationSchema = openEnum(['running', 'ended', 'noData'], 'running');

const nullableNumberSchema = z.number().nullable().catch(null);

// WHY: a bus standing at the station is `arriving` until it departs; a server before that
// change still sends `atStop`, which reads the same.
const arrivalStatusSchema = openEnum(['arriving', 'enRoute', 'waitingToDepart', 'scheduled', 'unknown', 'atStop'], 'unknown').transform(
  (status): ArrivalStatus => (status === 'atStop' ? 'arriving' : status),
);

export const liveArrivalSchema = z
  .object({
    status: arrivalStatusSchema,
    expectedArrivalAt: nullableInstantSchema,
    stopsAway: integerSchema.nullable().catch(null),
    isLastRun: z.boolean().catch(false),
    vehicleId: nullableTextSchema,
    providerText: nullableTextSchema,
  })
  .transform(({ expectedArrivalAt, ...arrival }) => ({ ...arrival, expectedArrivalAtMs: expectedArrivalAt }) satisfies LiveArrival);

/** WHY: a position without its station or either clock cannot be placed or aged, so the bus has none. */
const positionSchema = z
  .object({
    stationIndex: stationIndexSchema,
    status: openEnum(['inTransit', 'atStop', 'waitingToDepart'], 'inTransit'),
    progress: nullableNumberSchema,
    sectionMeters: nullableNumberSchema,
    nextStationAt: nullableInstantSchema,
    positionAt: instantSchema,
    checkedAt: instantSchema,
  })
  .transform(
    ({ nextStationAt, positionAt, checkedAt, ...position }) =>
      ({ ...position, nextStationAtMs: nextStationAt, positionAtMs: positionAt, checkedAtMs: checkedAt }) satisfies VehiclePosition,
  );

const knotSchema = z.object({ at: instantSchema, s: z.number() }).transform(({ at, s }) => ({ atMs: at, s }) satisfies TrajectoryKnot);

const isAscending = (knots: TrajectoryKnot[]) =>
  knots.every((knot, index) => {
    const prev = knots[index - 1];
    return !prev || (knot.atMs >= prev.atMs && knot.s >= prev.s);
  });

/**
 * WHY: a partial path would be followed as if whole, so one unreadable or out-of-order knot drops the
 * trajectory and the bus is placed from its position.
 */
const trajectorySchema = wholeList(knotSchema, 'bus.live.trajectory').refine(isAscending);

const crowdingSchema = openEnum(['relaxed', 'normal', 'crowded']).transform((level) => level ?? null);

// WHY: markers are keyed by vehicle id; keying an id-less bus by its list position would re-key every
// bus after one that drops, and their markers would jump, so a vehicle without an id is skipped.
export const liveVehicleSchema = z
  .object({
    id: text,
    plateNumber: nullableTextSchema,
    occupancy: z.object({ level: crowdingSchema }).catch({ level: null }),
    isLowFloor: z.boolean().nullable().catch(null),
    position: positionSchema.nullable().catch(null),
    trajectory: trajectorySchema.nullable().catch(null),
  })
  .transform(({ occupancy, ...vehicle }) => ({ ...vehicle, crowding: occupancy.level }) satisfies LiveVehicle);

const ARRIVALS: ServedList = { where: 'bus.live.arrivals' };

const liveStationSchema = z.object({
  stationIndex: stationIndexSchema,
  operation: liveOperationSchema,
  arrivals: servedList(liveArrivalSchema, ARRIVALS),
}) satisfies z.ZodType<LiveStation>;

export const liveGroupSchema = z
  .object({
    meta: envelopeMetaSchema,
    data: z.object({
      groupId: z.string(),
      updatedAt: nullableInstantSchema,
      operation: liveOperationSchema,
      vehicles: servedList(liveVehicleSchema, { where: 'bus.live.vehicles', keepsCache: true }),
      stations: servedList(liveStationSchema, { where: 'bus.live.stations', keepsCache: true }),
    }),
  })
  .transform(
    ({ meta, data: { updatedAt, ...group } }) =>
      ({ ...group, updatedAtMs: updatedAt, ...(meta.serverNow !== null && { serverNowMs: meta.serverNow }) }) satisfies LiveGroup,
  );
