// CONTRACT(skkuverse-server): skkuverse-server/src/bus/ writes the smart schedule; its produced
// fixtures are the smart-schedule fixtures this feature's suites read.
import { z } from 'zod';
import { finiteNumber, openEnum, text } from '@skkuverse/shared';
import { optionalStringSchema, servedList, wholeList, type ServedList } from './transit.schema';
import type { DaySchedule, ScheduleEntry, ScheduleNotice, SmartSchedule } from './transit.types';

const noticeSchema = z.object({
  style: openEnum(['info', 'warning', 'ai'], 'info'),
  text: z.string(),
  source: z.string(),
}) satisfies z.ZodType<ScheduleNotice>;

const etaSchema = z.object({
  source: openEnum(['live', 'frozen', 'predicted', 'unknown'], 'unknown'),
  updatedAt: text,
}) satisfies z.ZodType<NonNullable<ScheduleEntry['eta']>>;

const stopTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

/** WHY: one malformed time drops the whole list, so the row shows no stop times rather than a partly wrong set. */
const stopTimesSchema = wholeList(stopTimeSchema, 'bus.schedule.stopTimes');

const entrySchema = z
  .object({
    index: finiteNumber,
    time: z.string(),
    routeType: z.string(),
    busCount: finiteNumber.catch(1),
    notes: optionalStringSchema,
    stopTimes: stopTimesSchema.optional().catch(undefined),
    eta: etaSchema.optional().catch(undefined),
    // QUIRK(skkuverse-server): crowding is not served yet; it arrives with rider voting.
    crowding: openEnum(['unknown', 'spacious', 'crowded', 'full'], 'unknown'),
  })
  .transform(
    ({ notes, stopTimes, eta, ...entry }) =>
      ({ ...entry, ...(notes !== undefined && { notes }), ...(stopTimes && { stopTimes }), ...(eta && { eta }) }) satisfies ScheduleEntry,
  );

const NOTICES: ServedList = { where: 'bus.schedule.notices' };
const ENTRIES: ServedList = { where: 'bus.schedule.entries', keepsCache: true };

const daySchema = z
  .object({
    date: z.string(),
    dayOfWeek: finiteNumber,
    display: z.string(),
    label: optionalStringSchema,
    notices: servedList(noticeSchema, NOTICES),
    schedule: servedList(entrySchema, ENTRIES),
  })
  .transform(({ label, ...day }) => ({ ...day, ...(label !== undefined && { label }) }) satisfies DaySchedule);

export const smartScheduleSchema = z
  .object({
    serviceId: z.string(),
    status: z.string(),
    from: optionalStringSchema,
    selectedDate: optionalStringSchema,
    days: servedList(daySchema, { where: 'bus.schedule.days', keepsCache: true, inner: { schedule: { ...ENTRIES, item: entrySchema } } }),
    resumeDate: optionalStringSchema,
    message: optionalStringSchema,
  })
  .transform(
    ({ from, selectedDate, resumeDate, message, ...schedule }) =>
      ({
        ...schedule,
        ...(from !== undefined && { from }),
        ...(selectedDate !== undefined && { selectedDate }),
        ...(resumeDate !== undefined && { resumeDate }),
        ...(message !== undefined && { message }),
      }) satisfies SmartSchedule,
  );
