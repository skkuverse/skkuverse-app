// CONTRACT(skkuverse-server): skkuverse-server/contracts/produced/notices.noticeScreen.schema.json and the `row` of
// notices-list.noticeList; every string is finished server text (skkuverse/docs/decisions/0009-notice-list-rows.md).
import type { MapPlaceRef } from '@skkuverse/shared';

export const NOTICE_LIST_ROW_TONES = [
  'urgent',
  'today',
  'cancelled',
  'closed',
  'stopped',
  'postponed',
  'extended',
  'changed',
] as const;
export type NoticeListRowTone = (typeof NOTICE_LIST_ROW_TONES)[number];

export const NOTICE_LIST_ROW_DAYS = ['today', 'yesterday', 'thisWeek', 'earlier'] as const;
export type NoticeListRowDay = (typeof NOTICE_LIST_ROW_DAYS)[number];

export const NOTICE_LIST_ROW_DATE_MARKS = ['warning', 'abstain'] as const;
export type NoticeListRowDateMark = (typeof NOTICE_LIST_ROW_DATE_MARKS)[number];

export interface NoticeListRowToken {
  text: string;
  /** WHY: null for a tone this build does not know; its text still shows, in neutral ink. */
  tone: NoticeListRowTone | null;
}

export interface NoticeListRow {
  token: NoticeListRowToken | null;
  title: string;
  when: string | null;
  isUrgent: boolean;
  dateMark: NoticeListRowDateMark | null;
  qualifier: string | null;
  board: string | null;
  isDimmed: boolean;
  day: NoticeListRowDay | null;
}

export const NOTICE_ACTION_KINDS = ['map', 'search', 'call', 'email', 'link'] as const;
export type NoticeActionKind = (typeof NOTICE_ACTION_KINDS)[number];

export type NoticeAction =
  | { kind: 'map'; place: MapPlaceRef; space: string | null }
  | { kind: 'search'; query: string }
  | { kind: 'call'; number: string }
  | { kind: 'email'; address: string; subject: string | null }
  | { kind: 'link'; url: string };

export const NOTICE_SCREEN_LINE_SOURCES = ['body', 'poster', 'attachment'] as const;
export type NoticeScreenLineSource = (typeof NOTICE_SCREEN_LINE_SOURCES)[number];

export interface NoticeScreenLine {
  text: string;
  sub: string | null;
  source: NoticeScreenLineSource;
  actions: NoticeAction[];
  quote: string | null;
}

export interface NoticeScreenBlock {
  label: string;
  isNumbered: boolean;
  lines: NoticeScreenLine[];
  foldedLines: NoticeScreenLine[];
  footerLink: string | null;
}

export const NOTICE_SCREEN_STATUS_TONES = ['open', 'soon', 'closed', 'stopped', 'neutral'] as const;
export type NoticeScreenStatusTone = (typeof NOTICE_SCREEN_STATUS_TONES)[number];

export interface NoticeScreenStatus {
  word: string;
  detail: string | null;
  tone: NoticeScreenStatusTone;
}

export interface NoticeScreenChange {
  what: string;
  before: string;
  after: string;
}

export interface NoticeScreenBarAction {
  label: string;
  action: NoticeAction;
}

export const NOTICE_SCREEN_COLLAPSES = ['closed', 'cancelled'] as const;
export type NoticeScreenCollapse = (typeof NOTICE_SCREEN_COLLAPSES)[number];

export interface NoticeScreenOriginalAttachment {
  role: string;
  name: string;
}

export interface NoticeScreenOriginalLink {
  role: string;
  domain: string;
  url: string | null;
}

export interface NoticeScreenOriginal {
  posterCount: number;
  attachments: NoticeScreenOriginalAttachment[];
  links: NoticeScreenOriginalLink[];
}

export interface NoticeScreen {
  firstSeen: string | null;
  change: NoticeScreenChange | null;
  status: NoticeScreenStatus | null;
  blocks: NoticeScreenBlock[];
  action: NoticeScreenBarAction | null;
  collapsed: NoticeScreenCollapse | null;
  isStaffOnly: boolean;
  isPosterOnly: boolean;
  original: NoticeScreenOriginal;
}
