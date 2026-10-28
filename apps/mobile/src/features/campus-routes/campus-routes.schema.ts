// CONTRACT(skkuverse-server): skkuverse-server/src/journey/routes/journey-routes.wire.ts serves GET /journey/routes
// and publishes its fixtures as journey-routes.journeyRoutes; the call is src/shared/call.wire.ts.
import { z } from 'zod';
import {
  finiteNumber,
  openEnum,
  openUnionArray,
  opt,
  parseActionType,
  parsedBy,
  text,
  toEpochMs,
  tolerantArray,
} from '@skkuverse/shared';
import type {
  BoardCall,
  CampusRoute,
  UpcomingCall,
  PlaceAction,
  RouteLeg,
  RoutePlace,
  RouteWarning,
} from './campus-routes.types';

const instant = parsedBy((v) => (typeof v === 'string' ? toEpochMs(v) : null));

const optionalInstant = instant.nullish().catch(undefined).transform((v) => v ?? undefined);

// WHY: an action type this build does not know parses to 'unknown', which dispatches nothing, so the place reads as untappable.
const actionSchema = z
  .object({ actionType: z.unknown().transform(parseActionType), actionValue: text })
  .transform((a): PlaceAction | undefined => (a.actionType === 'unknown' ? undefined : a));

const placeSchema = z
  .object({ name: text, action: opt(actionSchema).catch(undefined) })
  .transform(({ name, action }): RoutePlace => (action ? { name, action } : { name }));

const callSchema = z
  .object({
    runId: opt(text).catch(undefined),
    vehicleId: opt(text).catch(undefined),
    // WHY: a missing or non-boolean flag reads as not last; the last-run mark is shown only on the server's word.
    isLastRun: z.boolean().catch(false),
  })
  .transform(({ runId, vehicleId, isLastRun }): BoardCall => ({ isHeadwayGuess: !runId && !vehicleId, isLastRun }));

// WHY: an unreadable call has no run or vehicle we can name, so its time is hedged like a guess.
const UNKNOWN_CALL: BoardCall = { isHeadwayGuess: true, isLastRun: false };

// CONTRACT(skkuverse-server): skkuverse-server/docs/decisions/0022-journey-and-call-spec.md D2 and D5's `toBoardTime`
// amendment: a late run leaves no earlier than it arrives, so the later expected arrival wins; a call with no time drops alone.
const upcomingCallSchema = z
  .object({
    expectedDepartureAt: optionalInstant,
    scheduledDepartureAt: optionalInstant,
    expectedArrivalAt: optionalInstant,
    scheduledArrivalAt: optionalInstant,
  })
  .and(callSchema)
  .transform((call, ctx): UpcomingCall => {
    const listed = call.expectedDepartureAt ?? call.scheduledDepartureAt ?? call.expectedArrivalAt ?? call.scheduledArrivalAt;
    if (listed === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a call with no time' });
      return z.NEVER;
    }
    const at = call.expectedArrivalAt !== undefined && call.expectedArrivalAt > listed ? call.expectedArrivalAt : listed;
    return { at, isHeadwayGuess: call.isHeadwayGuess, isLastRun: call.isLastRun };
  });

const legBase = {
  from: placeSchema,
  to: placeSchema,
  startAt: instant,
  endAt: instant,
  durationSec: finiteNumber,
  label: text,
  icon: z.string().catch(''),
  color: opt(z.string().regex(/^[0-9a-fA-F]{6}$/)).catch(undefined),
};

const KNOWN_LEG_KINDS = ['ride', 'walk', 'transfer'];

// WHY: a kind this build does not know is drawn from the base, never skipped, so the trip keeps every step
// (skkuverse-server ADR 0022, D5). A leg whose base cannot be read fails its option.
const stopSchema = z.object({ place: placeSchema });

// WHY: every stop or none; a list missing one would miscount the ride, so it reads as unknown (null), as a server
// that predates the field does.
const stopsSchema = parsedBy((raw): RoutePlace[] | null => {
  if (!Array.isArray(raw)) return null;
  const places = raw.flatMap((stop) => {
    const result = stopSchema.safeParse(stop);
    return result.success ? [result.data.place] : [];
  });
  return places.length === raw.length ? places : null;
})
  .nullable()
  .catch(null);

const legSchema = z.union([
  z
    .object({
      kind: z.literal('ride'),
      ...legBase,
      mode: z.unknown(),
      board: callSchema.catch(UNKNOWN_CALL),
      upcoming: tolerantArray(upcomingCallSchema, 'campusRoutes.upcoming').catch([]),
      stops: stopsSchema,
    })
    .transform(({ mode, ...leg }) => ({ ...leg, isRail: mode === 'subway' })),
  z.object({ kind: z.literal(['walk', 'transfer']), ...legBase }),
  z
    .object({ kind: text.refine((kind) => !KNOWN_LEG_KINDS.includes(kind)), ...legBase })
    .transform((leg) => ({ ...leg, kind: 'other' as const })),
]);

// WHY: every leg or none; a trip missing a step would misstate it, so one unreadable leg fails its option.
const legsSchema = parsedBy((raw): [RouteLeg, ...RouteLeg[]] | null => {
  if (!Array.isArray(raw)) return null;
  const [first, ...rest] = raw.flatMap((leg) => {
    const result = legSchema.safeParse(leg);
    return result.success ? [result.data] : [];
  });
  return first && rest.length + 1 === raw.length ? [first, ...rest] : null;
});

const warningSchema = z.object({ code: text, message: text }).transform((w) => w satisfies RouteWarning);

const optionBase = {
  id: text,
  name: text,
  warnings: tolerantArray(warningSchema, 'campusRoutes.warnings').catch([]),
};

const runningSchema = z.object({
  status: z.literal('running'),
  ...optionBase,
  leaveAt: instant,
  arriveAt: instant,
  legs: legsSchema,
});

const notRunningSchema = z.object({
  status: z.literal('notRunning'),
  ...optionBase,
  // WHY: the set is open; a reason this build does not know reads as ended (ADR 0022, D7).
  reason: openEnum(['ended', 'notStarted', 'unavailable'] as const, 'ended'),
  nextServiceAt: optionalInstant,
});

const routeSchema = z.object({
  id: text,
  name: text,
  // WHY: a malformed option drops alone and is reported; a status this build does not know is skipped.
  options: openUnionArray('status', { running: runningSchema, notRunning: notRunningSchema }, 'campusRoutes.options'),
});

export const campusRoutesSchema = z.object({
  routes: tolerantArray(routeSchema, 'campusRoutes.routes'),
}) satisfies z.ZodType<{ routes: CampusRoute[] }>;

export const campusRoutesMetaSchema = z
  .object({ serverNow: optionalInstant })
  .catch({ serverNow: undefined })
  .transform(({ serverNow }) => (serverNow === undefined ? {} : { serverNowMs: serverNow }));

