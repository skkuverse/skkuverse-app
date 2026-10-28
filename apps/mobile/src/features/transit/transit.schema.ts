import { z } from 'zod';
import { CAMPUSES, openEnum, text, tolerantArray, type LatLng } from '@skkuverse/shared';
import type { TransitLine } from './transit.types';

export const nullableTextSchema = text.nullable().catch(null);

/** WHY: unlike `optionalText`, an empty string is kept as served; only `null` or another type reads as absent. */
export const optionalStringSchema = z.string().optional().catch(undefined);

/** WHY: a campus newer than this build reads as none, so the section, stop or station it tags is never lost. */
export const campusSchema = openEnum(CAMPUSES).transform((campus) => campus ?? null);

const hex6Schema = z.string().regex(/^[0-9A-Fa-f]{6}$/);

/** WHY: the marker is how the screen names a line (a station row shows no subtitle), so a line without one is broken. */
export const subwayLineSchema = z.object({
  code: text,
  name: text,
  color: hex6Schema,
  marker: z.object({ text, color: hex6Schema }),
}) satisfies z.ZodType<TransitLine>;

export const instantSchema = z.string().transform(Date.parse).pipe(z.number());

export const nullableInstantSchema = instantSchema.nullable().catch(null);

export const integerSchema = z.number().refine(Number.isInteger);

export const stationIndexSchema = integerSchema.min(0);

export const latLngSchema = z.object({ lat: z.number(), lng: z.number() }) satisfies z.ZodType<LatLng>;

/** WHY: an envelope without `meta` is not the server's and fails; a `meta` that is not an object only loses the clock. */
export const envelopeMetaSchema = z.unknown().pipe(z.object({ serverNow: nullableInstantSchema }).catch({ serverNow: null }));

/** WHY: one unreadable item fails the whole list, since a part of it would be read as if it were all of it. */
export function wholeList<T extends z.ZodType>(item: T, where: string, minLength = 1) {
  return z
    .custom<unknown[]>((raw) => Array.isArray(raw) && raw.length >= minLength && raw.every((each) => item.safeParse(each).success))
    .pipe(tolerantArray(item, where));
}

const isObject = (raw: unknown): raw is object => raw !== null && typeof raw === 'object';

/** WHY: a list item that is itself a list has no fields, so it reads as an object with none. */
function listItem<T extends z.ZodType>(item: T) {
  return z.preprocess((raw) => (Array.isArray(raw) ? {} : raw), item);
}

export interface ServedList {
  where: string;
  keepsCache?: boolean;
  inner?: Record<string, ServedList & { item: z.ZodType }>;
}

/** WHY: only a list that keeps the cache fails on a value that is not a list; any other list reads it as empty. */
function listShape({ where, keepsCache = false }: ServedList) {
  return z.preprocess(
    (raw) => (keepsCache || Array.isArray(raw) ? raw : null),
    z.custom<unknown[]>(Array.isArray, `${where}: not a list`).nullish(),
  );
}

const everyItemDropped = (where: string) => `${where}: every served item dropped`;

/**
 * WHY: when a list inside an item fails, the response fails, never that item alone. Its floor asks whether one
 * of its items reads, since running the list reader here would report each dropped item twice.
 */
function innerListsOf(inner: Record<string, ServedList & { item: z.ZodType }>) {
  const shapes = Object.entries(inner).map(([key, { item, ...list }]) => {
    const each = listItem(item);
    const readsOne = (items: unknown[]) => items.some((raw) => each.safeParse(raw).success);
    return [key, listShape(list).refine((items) => !list.keepsCache || !items?.length || readsOne(items), everyItemDropped(list.where))];
  });
  const lists = listItem(z.object(Object.fromEntries(shapes)));
  return (items: readonly unknown[] | null | undefined, ctx: z.RefinementCtx) => {
    items?.forEach((raw, index) => {
      if (!isObject(raw)) return;
      for (const issue of lists.safeParse(raw).error?.issues ?? []) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: [index, ...issue.path] });
      }
    });
  };
}

/**
 * WHY: a list that keeps the cache fails when its served items all drop, so React Query keeps the cached data;
 * an absent or `null` list reads as empty, and a null or scalar item drops alone.
 */
export function servedList<T extends z.ZodType>(item: T, list: ServedList) {
  return listShape(list)
    .superRefine(innerListsOf(list.inner ?? {}))
    .transform((items) => ({ served: items?.length ?? 0, read: items ?? [] }))
    .pipe(z.object({ served: z.number(), read: tolerantArray(listItem(item), list.where) }))
    .refine(({ served, read }) => !list.keepsCache || !served || read.length > 0, everyItemDropped(list.where))
    .transform(({ read }) => read);
}
