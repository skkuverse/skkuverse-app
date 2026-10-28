// WHY: the fixtures stand in for a wire that does not exist yet (ADR 0010 open
// question 1), so they are read as tolerantly as a server response would be.
import { z } from 'zod';
import { openEnum, opt, optionalText, parsedBy, text, tolerantArray, toEpochMs } from '@skkuverse/shared';
import type { ThisWeekFeed, ThisWeekItem, ThisWeekSession } from './this-week.types';

const instant = parsedBy((raw) => (typeof raw === 'string' ? toEpochMs(raw) : null));
const optionalInstant = parsedBy((raw): number | null | undefined => (typeof raw === 'string' ? toEpochMs(raw) : undefined)).transform(
  (value) => value ?? null,
);

const placeSchema = z.object({
  skkuId: opt(z.number().int()).transform((id) => id ?? null),
  buildingName: text,
  room: optionalText.transform((room) => room ?? null),
});

const sessionSchema = z.object({
  name: z.string().catch(''),
  startAt: instant,
  endAt: optionalInstant,
  timeKnown: z.boolean().catch(false),
  places: tolerantArray(placeSchema, 'thisWeek.places').refine((places) => places.length > 0),
}) satisfies z.ZodType<ThisWeekSession>;

const itemSchema = z.object({
  id: text,
  sourceId: text,
  articleNo: z.number().int(),
  campus: openEnum(['hssc', 'nsc']).refine((campus) => campus !== undefined),
  kind: openEnum(['event', 'operation', 'call', 'job', 'staff'], 'staff'),
  title: text,
  shortTitle: optionalText.transform((title) => title ?? null),
  restriction: optionalText.transform((value) => value ?? null),
  benefit: optionalText.transform((value) => value ?? null),
  signUp: z
    .object({
      status: openEnum(['dated', 'undated', 'none'], 'none'),
      windows: tolerantArray(z.object({ startAt: optionalInstant, endAt: optionalInstant }), 'thisWeek.windows'),
    })
    .catch({ status: 'none', windows: [] }),
  sessions: tolerantArray(sessionSchema, 'thisWeek.sessions').transform((sessions) =>
    [...sessions].sort((a, b) => a.startAt - b.startAt),
  ),
  imageUrl: optionalText.transform((url) => url ?? null),
});

export const thisWeekFeedSchema = z.object({
  now: instant,
  items: tolerantArray(itemSchema, 'thisWeek.items').transform((items) =>
    items.flatMap((item): ThisWeekItem[] => (item.campus === undefined ? [] : [{ ...item, campus: item.campus }])),
  ),
}) satisfies z.ZodType<ThisWeekFeed>;

export function parseThisWeekFeed(raw: unknown): ThisWeekFeed | null {
  const result = thisWeekFeedSchema.safeParse(raw);
  return result.success ? result.data : null;
}
