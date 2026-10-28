// CONTRACT(skkuverse-server): skkuverse-server/src/ui/ writes this shape and publishes its fixture as
// ui-campus.campusSheet. WHY: a null or scalar section or button drops alone and is reported, and an
// unknown section `type` reads as `unknown`, so a new section never takes the feed down.
import { z } from 'zod';
import { bannerCarouselSchema, finiteNumber, parseActionType, tolerantArray } from '@skkuverse/shared';
import { maybeString } from '../map.schema';
import type {
  CampusSectionsResponse,
  SduiBanner,
  SduiBannerCarousel,
  SduiButtonGrid,
  SduiButtonItem,
  SduiNotice,
  SduiSectionTitle,
  SduiSpacer,
  SduiUnknown,
} from './campus-sheet.types';

/** WHY: a missing or non-string field reads as blank, so its widget still draws instead of leaving the sheet. */
const stringOrBlank = z.string().catch('');

const actionType = z.unknown().optional().transform(parseActionType);

const buttonItemSchema = z.object({
  id: stringOrBlank,
  title: stringOrBlank,
  emoji: stringOrBlank,
  actionType,
  actionValue: stringOrBlank,
  webviewTitle: maybeString,
  webviewColor: maybeString,
}) satisfies z.ZodType<SduiButtonItem>;

const buttonGridSchema = z.object({
  type: z.literal('button_grid'),
  id: stringOrBlank,
  columns: finiteNumber.catch(4),
  items: tolerantArray(buttonItemSchema, 'campus.sections.items'),
}) satisfies z.ZodType<SduiButtonGrid>;

const sectionTitleSchema = z.object({
  type: z.literal('section_title'),
  id: stringOrBlank,
  title: stringOrBlank,
}) satisfies z.ZodType<SduiSectionTitle>;

const noticeSchema = z.object({
  type: z.literal('notice'),
  id: stringOrBlank,
  title: stringOrBlank,
  actionType,
  actionValue: stringOrBlank,
}) satisfies z.ZodType<SduiNotice>;

const bannerSchema = z.object({
  type: z.literal('banner'),
  id: stringOrBlank,
  imageUrl: stringOrBlank,
  actionType,
  actionValue: stringOrBlank,
}) satisfies z.ZodType<SduiBanner>;

const carouselSchema = z
  .custom((raw) => typeof raw === 'object' && raw !== null && 'type' in raw && raw.type === 'banner_carousel')
  .pipe(bannerCarouselSchema)
  .transform(
    (carousel): SduiBannerCarousel => ({ ...carousel, items: carousel.items.filter((item) => item.type === 'image') }),
  );

const spacerSchema = z.object({
  type: z.literal('spacer'),
  id: stringOrBlank,
  height: finiteNumber.catch(16),
}) satisfies z.ZodType<SduiSpacer>;

const unknownSectionSchema = z
  .object({ type: stringOrBlank, id: stringOrBlank })
  .transform(({ type, id }): SduiUnknown => ({ type: 'unknown', id, originalType: type }));

/** WHY: `unknown` comes last, so a section none of the others reads, an unreadable carousel too, keeps its place. */
const sectionSchema = z.union([
  buttonGridSchema,
  sectionTitleSchema,
  noticeSchema,
  bannerSchema,
  carouselSchema,
  spacerSchema,
  unknownSectionSchema,
]);

/** WHY: a non-object `data` fails the parse, so the query fails and `dataOrFallback` serves the bundled sections. */
export const campusSectionsSchema = z.object({
  minAppVersion: z.string().nullable().catch(null),
  sections: tolerantArray(sectionSchema, 'campus.sections'),
}) satisfies z.ZodType<CampusSectionsResponse>;
