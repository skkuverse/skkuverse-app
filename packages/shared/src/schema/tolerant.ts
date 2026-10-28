// WHY: old OTA bundles stay installed for months, so a new field, a new enum
// member or one malformed item must never fail a whole response.
// SEE: docs/decisions/0020-app-architecture.md (D6)
import { z } from 'zod';

type DropReporter = (where: string, index: number, error: unknown) => void;

let reportDrop: DropReporter = (where, index, error) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[schema] dropped ${where}[${index}]`, error);
  }
};

export function setDropReporter(reporter: DropReporter): void {
  reportDrop = reporter;
}

export function tolerantArray<T extends z.ZodType>(item: T, where: string) {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((raw, index): z.output<T>[] => {
      const result = item.safeParse(raw);
      if (result.success) return [result.data];
      reportDrop(where, index, result.error);
      return [];
    }),
  );
}

/**
 * WHY: a member whose discriminant this build does not know is skipped silently; a malformed known
 * member is dropped and reported.
 */
export function openUnionArray<K extends string, O extends Record<string, z.ZodType>>(
  key: K,
  options: O,
  where: string,
) {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((raw, index): z.output<O[keyof O]>[] => {
      const discriminant = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
      const schema = typeof discriminant === 'string' && Object.hasOwn(options, discriminant) ? options[discriminant] : undefined;
      if (raw !== null && typeof raw === 'object' && !schema) return [];
      const result = schema?.safeParse(raw);
      if (result?.success) return [result.data as z.output<O[keyof O]>];
      reportDrop(where, index, result?.error ?? raw);
      return [];
    }),
  );
}

/** WHY: a `null` result fails the parse, so in a list it drops that item alone. */
export function parsedBy<T>(parse: (raw: unknown) => T | null) {
  // QUIRK(zod): a bare transform makes its object key required; .optional() lets an absent one through.
  return z
    .unknown()
    .optional()
    .transform((raw, ctx): T => {
      const parsed = parse(raw);
      if (parsed !== null) return parsed;
      ctx.addIssue({ code: 'custom', message: 'unreadable' });
      return z.NEVER;
    });
}

export function openEnum<const V extends readonly string[], F extends V[number] | undefined = undefined>(
  values: V,
  fallback?: F,
) {
  return parsedBy((value): V[number] | F => (values.includes(value as string) ? (value as V[number]) : (fallback as F)));
}

export const text = z.string().min(1);

export const optionalText = text.optional().catch(undefined);

export function opt<T extends z.ZodType>(schema: T) {
  return schema.nullish().transform((value): z.output<T> | undefined => value ?? undefined);
}

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** WHY: never `null`, `''` or a boolean read as 0. */
export const finiteNumber = z.union([
  z.number(),
  z
    .string()
    .trim()
    .regex(NUMERIC)
    .transform((value) => Number(value))
    .pipe(z.number()),
]);

/** WHY: throws, so the query fails and its fallback applies. */
export function parseOrThrow<T extends z.ZodType>(schema: T, raw: unknown, where: string): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${where}: ${z.prettifyError(result.error)}`);
  return result.data;
}
