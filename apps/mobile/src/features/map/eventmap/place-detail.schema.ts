// CONTRACT(skkuverse-server): skkuverse-server/src/map/ writes this shape and publishes its fixtures as
// map.eventDetails. WHY: a null or malformed detail drops alone and is reported, and a detail whose kind
// this build does not know is skipped silently.
import { z } from 'zod';
import { openEnum, openUnionArray, text, tolerantArray } from '@skkuverse/shared';
import { i18nText, required, requiredI18n } from '../map.schema';
import {
  PLACE_KINDS,
  type PlaceAction,
  type PlaceBlock,
  type PlaceBlockType,
  type PlaceDetail,
  type PlaceListItem,
  type PlaceTableRow,
} from './place-detail.types';

const httpsUrl = z.string().regex(/^https:\/\/[^\s/]+/);

/** WHY: a list, table or notice with no readable row is dropped rather than drawn as a heading over nothing. */
function rowsOf<T extends z.ZodType>(row: T, where: string) {
  return tolerantArray(row, where)
    .catch(() => [])
    .refine((rows) => rows.length > 0);
}

const listItemSchema = z.object({
  emoji: text.nullable().catch(null),
  title: requiredI18n,
  description: i18nText,
}) satisfies z.ZodType<PlaceListItem>;

const tableRowSchema = z.object({ label: requiredI18n, value: requiredI18n }) satisfies z.ZodType<PlaceTableRow>;

const blockHead = { id: text, title: i18nText };

/** WHY: an unknown `type` drops one block and leaves the rest, and a block type without its schema fails to compile. */
const PLACE_BLOCKS = {
  text: z.object({ type: z.literal('text'), ...blockHead, body: requiredI18n }),
  list: z.object({ type: z.literal('list'), ...blockHead, items: rowsOf(listItemSchema, 'eventmap.list.items') }),
  table: z.object({ type: z.literal('table'), ...blockHead, rows: rowsOf(tableRowSchema, 'eventmap.table.rows') }),
  image: z.object({ type: z.literal('image'), ...blockHead, url: httpsUrl, caption: i18nText }),
  notice: z.object({ type: z.literal('notice'), ...blockHead, items: rowsOf(requiredI18n, 'eventmap.notice.items') }),
} satisfies Record<PlaceBlockType, z.ZodType<PlaceBlock>>;

const PLACE_ACTIONS = {
  link: z.object({ type: z.literal('link'), id: text, label: requiredI18n, url: httpsUrl }),
  instagram: z.object({
    type: z.literal('instagram'),
    id: text,
    label: requiredI18n,
    profileUrl: httpsUrl,
    postUrl: httpsUrl.nullable().catch(null),
  }),
} satisfies Record<PlaceAction['type'], z.ZodType<PlaceAction>>;

const placeDetailSchema = z.object({
  placeId: text,
  kind: required(openEnum(PLACE_KINDS)),
  org: i18nText,
  isUnion: z.boolean().catch(false),
  locationLabel: i18nText,
  actions: openUnionArray('type', PLACE_ACTIONS, 'eventmap.actions').catch(() => []),
  blocks: openUnionArray('type', PLACE_BLOCKS, 'eventmap.blocks').catch(() => []),
}) satisfies z.ZodType<PlaceDetail>;

const DETAILS_BY_KIND = Object.fromEntries(PLACE_KINDS.map((kind) => [kind, placeDetailSchema]));

const detailListSchema = z
  .unknown()
  .optional()
  .transform((details): unknown[] => (typeof details === 'object' && details !== null ? Object.values(details) : []))
  .pipe(openUnionArray('kind', DETAILS_BY_KIND, 'eventmap.details'));

/** WHY: keyed by the detail's own `placeId`, not the record key, so a sheet looks up the id the server stated. */
export const placeDetailsSchema = z
  .object({ details: detailListSchema })
  // WHY: an unreadable body reads as no details rather than a failed query, so each sheet draws from its overlay.
  .catch(() => ({ details: [] }))
  .transform(
    ({ details }): Record<string, PlaceDetail> => Object.fromEntries(details.map((detail) => [detail.placeId, detail])),
  );
