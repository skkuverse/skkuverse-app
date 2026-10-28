// CONTRACT(skkuverse-server): skkuverse-server/src/ui/transit/ui-transit.wire.ts owns the layout and fails
// loud at boot; this side fails soft, so an unknown or broken section or item costs that block alone.
// WHY: navigation goes by an item's `action` alone, never its `kind`; a tap on a `group` folds it.
import { z } from 'zod';
import { openEnum, openUnionArray, parseActionType, text, tolerantArray } from '@skkuverse/shared';
import { campusSchema, nullableTextSchema, subwayLineSchema } from './transit.schema';
import type { TransitGroup, TransitIcon, TransitLayout, TransitRowItem, TransitSection } from './transit.types';

const iconSchema = z.object({ type: text, color: text, text: z.string() }) satisfies z.ZodType<TransitIcon>;

const knownActionTypeSchema = z
  .unknown()
  .transform(parseActionType)
  .refine((type) => type !== 'unknown');

const rowFields = {
  id: text,
  title: text,
  subtitle: nullableTextSchema,
  action: z.object({ actionType: knownActionTypeSchema, actionValue: text }),
};

const rowSchemas = {
  bus: z
    .object({ ...rowFields, groupId: text, icon: iconSchema })
    .transform((row) => ({ kind: 'bus', ...row }) satisfies TransitRowItem),
  subway: z
    .object({
      ...rowFields,
      stationId: text,
      lines: tolerantArray(subwayLineSchema, 'transit.lines')
        .catch([])
        .refine((lines) => lines.length > 0),
    })
    .transform((row) => ({ kind: 'subway', ...row }) satisfies TransitRowItem),
  link: z
    .object({ ...rowFields, icon: iconSchema })
    .transform((row) => ({ kind: 'link', ...row }) satisfies TransitRowItem),
};

const groupSchema = z
  .object({
    id: text,
    title: text,
    subtitle: nullableTextSchema,
    icon: iconSchema,
    // WHY: a state newer than this build draws folded, so the rows stay one tap away.
    initialState: openEnum(['collapsed', 'expanded'], 'collapsed'),
    items: openUnionArray('kind', rowSchemas, 'transit.groupItems').refine((items) => items.length > 0),
  })
  .transform((group) => ({ kind: 'group', ...group }) satisfies TransitGroup);

const sectionSchema = z
  .object({
    id: text,
    // QUIRK(skkuverse-server): the campus section's title is `null` on purpose, so no title means no
    // header, never dropped rows.
    title: nullableTextSchema,
    campus: campusSchema,
    items: openUnionArray('kind', { ...rowSchemas, group: groupSchema }, 'transit.items').refine((items) => items.length > 0),
  })
  .transform((section) => ({ type: 'item_list', ...section }) satisfies TransitSection);

/** WHY: a payload that is not a layout fails, so the tab shows an error with retry, not an empty tab. */
export const transitLayoutSchema = z.object({
  version: z.number(),
  sections: openUnionArray('type', { item_list: sectionSchema }, 'transit.sections'),
}) satisfies z.ZodType<TransitLayout>;
