/**
 * WHY: a malformed point or source drops alone, but a cite that names no source fails the answer; a hidden
 * card beats a citation marker that opens nothing.
 */
import { z } from 'zod';
import { openEnum, parsedBy, parseOrThrow, text, tolerantArray, type ApiEnvelope } from '@skkuverse/shared';
import type { NoticeOverviewResult, OverviewDto, OverviewReason, OverviewSentence, OverviewSource } from './overview.types';

const REASONS = ['no_results', 'no_answer', 'unavailable'] as const satisfies readonly OverviewReason[];

const integer = z.number().refine(Number.isInteger);

/** WHY: every cite or none, so one unreadable cite fails its sentence rather than shrinking what backs it. */
function everyItem<T extends z.ZodType>(item: T) {
  return parsedBy((raw): z.output<T>[] | null => {
    if (!Array.isArray(raw)) return null;
    const items = raw.flatMap((entry) => {
      const result = item.safeParse(entry);
      return result.success ? [result.data] : [];
    });
    return items.length === raw.length ? items : null;
  });
}

const sentenceSchema = z.object({
  text,
  cites: everyItem(integer).refine((cites) => cites.length > 0),
}) satisfies z.ZodType<OverviewSentence>;

/** QUIRK(skkuverse-server): its TS type says string while the wire carries a number, so both are taken. */
const articleNo = z.union([
  integer,
  z
    .string()
    .regex(/^\d+$/)
    .transform((digits) => Number(digits))
    .pipe(integer),
]);

const sourceSchema = z.object({
  n: integer,
  sourceId: text,
  articleNo,
  title: text,
  date: z.string().transform((date) => date.slice(0, 10)),
  contentMissing: z.boolean().catch(false),
}) satisfies z.ZodType<OverviewSource>;

const overviewSchema = z
  .object({
    lead: sentenceSchema.nullish().transform((lead) => lead ?? null),
    points: tolerantArray(sentenceSchema, 'overview.points'),
    sources: tolerantArray(sourceSchema, 'overview.sources').transform((sources) => sources.sort((a, b) => a.n - b.n)),
    lang: openEnum(['ko', 'en'] as const, 'ko'),
    generatedAt: z.string(),
  })
  .refine(({ lead, points }) => lead !== null || points.length > 0, 'lead and points are both empty')
  .refine(({ lead, points, sources }) => {
    const known = new Set(sources.map((source) => source.n));
    return [lead, ...points].every((sentence) => !sentence || sentence.cites.every((cite) => known.has(cite)));
  }, 'a cite names no source') satisfies z.ZodType<OverviewDto>;

const noticeOverviewSchema = z
  .object({
    meta: z.object({ cached: z.boolean().catch(false), reason: openEnum(REASONS, 'unavailable') }),
    data: z.object({ overview: overviewSchema.nullish() }),
  })
  .transform(
    ({ meta, data: { overview } }): NoticeOverviewResult =>
      overview
        ? { overview, cached: meta.cached, reason: null }
        : { overview: null, cached: meta.cached, reason: meta.reason },
  );

export function parseNoticeOverview(envelope: ApiEnvelope<unknown>): NoticeOverviewResult {
  return parseOrThrow(noticeOverviewSchema, envelope, 'overview');
}
