// CONTRACT(skkuverse-server): skkuverse-server/docs/reference/subway-api.md
// WHY: a broken train, direction or line costs that one part, never the screen; only a payload with no
// station name, or served lines none of which reads, fails.
import { z } from 'zod';
import { openEnum, openUnionArray, text, tolerantArray } from '@skkuverse/shared';
import {
  campusSchema,
  integerSchema,
  latLngSchema,
  nullableInstantSchema,
  nullableTextSchema,
  subwayLineSchema,
} from '../transit.schema';
import type { ArrivalStatus } from '../transit.types';
import type {
  SubwayArrivals,
  SubwayArrivalsMeta,
  SubwayDirection,
  SubwayLineArrivals,
  SubwayStation,
  SubwayTrain,
} from './subway.types';

// WHY: the call's `stopsAway` skips platforms an express passes while the track ticks every station, so an
// express seen upstream gets no dot; 0 is standing here only while `arriving`, else the train has left.
function isOnTrack(stopsAway: number | null, status: ArrivalStatus, isExpress: boolean): boolean {
  if (stopsAway === null) return true;
  if (stopsAway === 0) return status === 'arriving';
  return !isExpress || (stopsAway === 1 && status === 'arriving');
}

const trainSchema = z
  .object({
    trainNo: text,
    headsign: text,
    isExpress: z.boolean().catch(false),
    expectedArrivalAt: nullableInstantSchema,
    scheduledArrivalAt: nullableInstantSchema,
    scheduledDepartureAt: nullableInstantSchema,
    // WHY: both enums are open; a value this build does not know reads as `unknown` and keeps the train.
    basis: openEnum(['provider', 'estimate', 'timetable', 'unknown'], 'unknown'),
    status: openEnum(['arriving', 'enRoute', 'waitingToDepart', 'scheduled', 'unknown'], 'unknown'),
    stopsAway: integerSchema.min(0).nullable().catch(null),
    // WHY: a null flag marks nothing.
    isFirstRun: z.boolean().catch(false),
    isLastRun: z.boolean().catch(false),
  })
  .transform(({ expectedArrivalAt, scheduledArrivalAt, scheduledDepartureAt, ...train }, ctx) => {
    // WHY: a train's origin has a timetable departure and no arrival.
    const arrivalAt = expectedArrivalAt ?? scheduledArrivalAt ?? scheduledDepartureAt;
    if (arrivalAt === null) {
      ctx.addIssue({ code: 'custom', message: 'no arrival time' });
      return z.NEVER;
    }
    return { ...train, arrivalAt, onTrack: isOnTrack(train.stopsAway, train.status, train.isExpress) } satisfies SubwayTrain;
  });

const directionFields = {
  name: text,
  nextStation: z.object({ name: nullableTextSchema }).catch({ name: null }),
  trains: tolerantArray(trainSchema, 'subway.trains')
    .catch([])
    .transform((trains) => trains.sort((a, b) => a.arrivalAt - b.arrivalAt)),
};

const directionSchemas = {
  up: z.object({ direction: z.literal('up'), ...directionFields }),
  down: z.object({ direction: z.literal('down'), ...directionFields }),
};

const lineArrivalsSchema = z.object({
  line: subwayLineSchema,
  directions: openUnionArray('direction', directionSchemas, 'subway.directions')
    .catch([])
    .transform((directions) =>
      directions.map(({ nextStation, ...direction }) => ({ ...direction, nextStationName: nextStation.name }) satisfies SubwayDirection),
    )
    .refine((directions) => directions.length > 0),
}) satisfies z.ZodType<SubwayLineArrivals>;

// WHY: no station, or every served line dropped, is an error with retry; a station served with no line
// at all (briefly, while the server deploys) is a station with no trains.
const linesSchema = z.union([
  z.custom<never[]>((raw) => Array.isArray(raw) && raw.length === 0),
  tolerantArray(lineArrivalsSchema, 'subway.lines').refine((lines) => lines.length > 0, 'subway arrivals: no readable line'),
]);

export const subwayArrivalsSchema = z
  .object({
    station: z.object({ id: text, name: text, coords: latLngSchema.nullable().catch(null) }),
    lines: linesSchema,
  })
  .transform(
    ({ station, lines }) => ({ stationId: station.id, stationName: station.name, coords: station.coords, lines }) satisfies SubwayArrivals,
  );

const stationSchema = z.object({
  id: text,
  title: text,
  campus: campusSchema,
  lines: tolerantArray(subwayLineSchema, 'subway.stations.lines').catch([]),
  coords: latLngSchema.nullable().catch(null),
}) satisfies z.ZodType<SubwayStation>;

// WHY: a list that is not one reads as no stations, which only leaves search and the launch camera without them.
export const subwayStationsSchema = z
  .object({ stations: tolerantArray(stationSchema, 'subway.stations').catch([]) })
  .catch({ stations: [] })
  .transform(({ stations }) => stations);

// QUIRK(skkuverse-server): a server that predates `meta.serverNow`, or sends no readable instant, omits it.
export const subwayArrivalsMetaSchema = z
  .object({ serverNow: nullableInstantSchema })
  .catch({ serverNow: null })
  .transform(({ serverNow }): SubwayArrivalsMeta => (serverNow === null ? {} : { serverNowMs: serverNow }));
