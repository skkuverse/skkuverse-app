// CONTRACT(skkuverse-server): skkuverse-server/contracts/produced/notices.noticeScreen.schema.json; a malformed row or
// screen reads as null, so its notice keeps today's row or detail rather than dropping.
import { z } from 'zod';
import { openEnum, openUnionArray, optionalText, parsedBy, text, tolerantArray } from '@skkuverse/shared';
import { toNoticeAction } from './notice-action.rules';
import {
  NOTICE_ACTION_KINDS,
  NOTICE_LIST_ROW_DATE_MARKS,
  NOTICE_LIST_ROW_DAYS,
  NOTICE_LIST_ROW_TONES,
  NOTICE_SCREEN_COLLAPSES,
  NOTICE_SCREEN_LINE_SOURCES,
  NOTICE_SCREEN_STATUS_TONES,
  type NoticeAction,
  type NoticeListRow,
  type NoticeListRowToken,
  type NoticeScreen,
  type NoticeScreenBarAction,
  type NoticeScreenBlock,
  type NoticeScreenChange,
  type NoticeScreenLine,
  type NoticeScreenOriginal,
  type NoticeScreenStatus,
} from './notice-facts.types';

// WHY: a missing or non-list field reads as an empty list, as the hand parser read it.
export const listOrEmpty = parsedBy((raw) => (Array.isArray(raw) ? raw : []));

export function nullOr<S extends z.ZodType>(objectSchema: S) {
  return z.union([z.null(), z.undefined()]).transform(() => null).or(objectSchema);
}

const flag = z.boolean().catch(false);
const textOrNull = optionalText.transform((value) => value ?? null);
const count = z.number().int().nonnegative().catch(0);
const httpUrlOrNull = z.string().regex(/^https?:\/\/\S+$/i).nullable().catch(null);
// WHY: a notice's link may be an address to write to, which the OS hands to the mail app.
const linkUrlOrNull = z.string().regex(/^(?:https?:\/\/|mailto:)\S+$/i).nullable().catch(null);

const rowTokenSchema = z
  .object({ text, tone: openEnum(NOTICE_LIST_ROW_TONES) })
  .transform(({ text: tokenText, tone }): NoticeListRowToken => ({ text: tokenText, tone: tone ?? null }));

export const noticeListRowSchema = nullOr(
  z
    .object({
      token: nullOr(rowTokenSchema).catch(null),
      title: text,
      when: textOrNull,
      urgent: flag,
      dateMark: openEnum(NOTICE_LIST_ROW_DATE_MARKS).transform((mark) => mark ?? null),
      qualifier: textOrNull,
      board: textOrNull,
      dimmed: flag,
      day: openEnum(NOTICE_LIST_ROW_DAYS).transform((day) => day ?? null),
    })
    .transform(({ urgent, dimmed, ...row }): NoticeListRow => ({ ...row, isUrgent: urgent, isDimmed: dimmed })),
).catch(null);

const actionFieldsSchema = z.object({ target: text, space: optionalText, subject: optionalText });

const ACTION_MEMBERS = Object.fromEntries(
  NOTICE_ACTION_KINDS.map((kind) => [kind, actionFieldsSchema.transform((fields) => toNoticeAction(kind, fields))]),
);

// WHY: an action this build cannot open drops silently, as an unknown kind does; it is not a malformed member.
const lineActionsSchema = listOrEmpty
  .pipe(openUnionArray('kind', ACTION_MEMBERS, 'notices.screen.actions'))
  .transform((actions) => actions.filter((action): action is NoticeAction => action !== null));

const lineSchema = z
  .object({
    text,
    sub: textOrNull,
    source: openEnum(NOTICE_SCREEN_LINE_SOURCES),
    // WHY: the live server sends `fromPoster` and no `source`; delete the flag once every served line has a source.
    fromPoster: flag,
    actions: lineActionsSchema,
    quote: textOrNull,
  })
  .transform(
    ({ source, fromPoster, ...line }): NoticeScreenLine => ({
      ...line,
      source: source ?? (fromPoster ? 'poster' : 'body'),
    }),
  );

/** WHY: every line is sent, and `foldedCount` names how many trailing lines start hidden. */
const blockSchema = z
  .object({
    label: text,
    numbered: flag,
    lines: listOrEmpty.pipe(tolerantArray(lineSchema, 'notices.screen.lines')),
    foldedCount: count,
    footerLink: textOrNull,
  })
  .transform(({ label, numbered, lines, foldedCount, footerLink }, ctx): NoticeScreenBlock => {
    if (lines.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'a block with no readable line' });
      return z.NEVER;
    }
    const shownCount = lines.length - Math.min(foldedCount, lines.length);
    return {
      label,
      isNumbered: numbered,
      lines: lines.slice(0, shownCount),
      foldedLines: lines.slice(shownCount),
      footerLink,
    };
  });

const changeSchema = z
  .object({ what: text, before: text, after: text })
  .transform((change): NoticeScreenChange => change);

const headerSchema = z
  .object({ firstSeen: textOrNull, change: nullOr(changeSchema).catch(null) })
  .catch(() => ({ firstSeen: null, change: null }));

const statusSchema = z
  .object({ word: text, detail: textOrNull, tone: openEnum(NOTICE_SCREEN_STATUS_TONES, 'neutral') })
  .transform((status): NoticeScreenStatus => status);

const barActionSchema = z
  .object({ label: text, kind: openEnum(NOTICE_ACTION_KINDS), target: text, space: optionalText, subject: optionalText })
  .transform(({ label, kind, ...fields }): NoticeScreenBarAction | null => {
    const action = kind ? toNoticeAction(kind, fields) : null;
    return action ? { label, action } : null;
  });

const originalSchema = z
  .object({
    posterCount: count,
    attachments: listOrEmpty.pipe(
      tolerantArray(z.object({ role: text, name: text, url: httpUrlOrNull }), 'notices.screen.original.attachments'),
    ),
    links: listOrEmpty.pipe(
      tolerantArray(z.object({ role: text, domain: text, url: linkUrlOrNull }), 'notices.screen.original.links'),
    ),
  })
  .transform((original): NoticeScreenOriginal => original)
  .catch(() => ({ posterCount: 0, attachments: [], links: [] }));

export const noticeScreenSchema = nullOr(
  z
    .object({
      header: headerSchema,
      status: nullOr(statusSchema).catch(null),
      blocks: listOrEmpty.pipe(tolerantArray(blockSchema, 'notices.screen.blocks')),
      action: nullOr(barActionSchema).catch(null),
      collapsed: openEnum(NOTICE_SCREEN_COLLAPSES).transform((collapse) => collapse ?? null),
      staffOnly: flag,
      posterOnly: flag,
      original: originalSchema,
    })
    .transform(
      ({ header, staffOnly, posterOnly, ...screen }): NoticeScreen => ({
        firstSeen: header.firstSeen,
        change: header.change,
        ...screen,
        isStaffOnly: staffOnly,
        isPosterOnly: posterOnly,
      }),
    ),
).catch(null);
