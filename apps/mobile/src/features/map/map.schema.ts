// WHY: lists are tolerant; a malformed item drops alone and is reported (ADR 0020 D6).
import { z } from 'zod';
import { parseI18nText, toFiniteNumber, tolerantArray, type I18nText } from '@skkuverse/shared';

export function required<T>(schema: z.ZodType<T | null | undefined>) {
  return schema.transform((value, ctx): T => {
    if (value != null) return value;
    ctx.addIssue({ code: 'custom', message: 'required' });
    return z.NEVER;
  });
}

// WHY: `toFiniteNumber`, never `Number()`, which reads null as 0 and garbage as NaN, and a NaN
// size or zoom draws nothing with no error. Absent means "the server did not say".
export const maybeNumber = z
  .unknown()
  .optional()
  .transform((raw) => toFiniteNumber(raw) ?? undefined);
export const numberOr = (fallback: number) => maybeNumber.transform((n) => n ?? fallback);
export const requiredNumber = required(maybeNumber);

export const maybeString = z.string().optional().catch(undefined);

export const i18nText = z.unknown().optional().transform(parseI18nText);
export const requiredI18n = required<I18nText>(i18nText);

/** WHY: an unreadable bound would make every comparison false. */
export const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

export function listOf<T extends z.ZodType>(item: T, where: string) {
  return tolerantArray(item, where)
    .nullish()
    .transform((items): z.output<T>[] => items ?? []);
}

const isFieldBearing = (raw: unknown): raw is Record<string, unknown> => raw !== null && typeof raw === 'object';

export const fieldBearingData = z.custom<Record<string, unknown>>(isFieldBearing, 'map data is not an object');
