/** WHY: the server-shaped types follow the PoC fixtures (`__fixtures__/`), which are not the final wire. */

import type { Campus } from '@skkuverse/shared';

export type ThisWeekWeekId = '2026-10-26' | '2026-10-19';

/** WHY: only the first three kinds reach the feed. */
export type ThisWeekItemKind = 'event' | 'operation' | 'call' | 'job' | 'staff';

export interface ThisWeekPlace {
  /** WHY: null for a place the map draws no circle for. */
  skkuId: number | null;
  buildingName: string;
  room: string | null;
}

export interface ThisWeekSession {
  name: string;
  startAt: number;
  /** WHY: exclusive, and null when the notice gives no end. */
  endAt: number | null;
  /** WHY: false when the notice names a day and no time; `startAt` is then that day's midnight. */
  timeKnown: boolean;
  places: readonly ThisWeekPlace[];
}

export interface ThisWeekSignUpWindow {
  startAt: number | null;
  endAt: number | null;
}

export interface ThisWeekSignUp {
  status: 'dated' | 'undated' | 'none';
  windows: readonly ThisWeekSignUpWindow[];
}

export interface ThisWeekItem {
  id: string;
  sourceId: string;
  articleNo: number;
  campus: Campus;
  kind: ThisWeekItemKind;
  title: string;
  shortTitle: string | null;
  restriction: string | null;
  benefit: string | null;
  signUp: ThisWeekSignUp;
  sessions: readonly ThisWeekSession[];
  imageUrl: string | null;
}

export interface ThisWeekFeed {
  now: number;
  items: readonly ThisWeekItem[];
}

export type ThisWeekGroupId = 'today' | 'thisWeek' | 'nextWeek';

export type ThisWeekScreenDay = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'date'; at: number };

export type ThisWeekOperationVerb = 'closed' | 'shortHours' | 'running' | 'open';

export type ThisWeekScreenWhen =
  | { kind: 'start'; day: ThisWeekScreenDay | null; at: number }
  | { kind: 'day'; day: ThisWeekScreenDay }
  | { kind: 'range'; from: ThisWeekScreenDay; to: ThisWeekScreenDay }
  | { kind: 'through'; to: ThisWeekScreenDay }
  | { kind: 'onNow'; until: number }
  | { kind: 'operation'; verb: ThisWeekOperationVerb; from: ThisWeekScreenDay | null; to: ThisWeekScreenDay | null };

export type ThisWeekScreenQualifier =
  | { kind: 'restriction'; audience: string }
  /** WHY: `at` only for a deadline today that is not the day's end; `urgent` for today or tomorrow. */
  | { kind: 'signUpCloses'; day: ThisWeekScreenDay; at: number | null; urgent: boolean }
  | { kind: 'signUpOpens'; day: ThisWeekScreenDay }
  | { kind: 'benefit'; text: string }
  | { kind: 'room'; room: string };

export type ThisWeekScreenToken = 'signUpClosed' | 'recruiting';

/** WHY: never a building photo. */
export type ThisWeekScreenThumbnail =
  | { kind: 'image'; url: string }
  | { kind: 'icon'; itemKind: 'event' | 'operation' | 'call' };

export type ThisWeekThumbnailFrame = { kind: 'pending' } | { kind: 'portrait'; aspectRatio: number } | { kind: 'cover' };

export interface ThisWeekScreenRow {
  item: ThisWeekItem;
  token: ThisWeekScreenToken | null;
  title: string;
  when: ThisWeekScreenWhen;
  moreSessions: number;
  qualifier: ThisWeekScreenQualifier | null;
  building: string;
  moreBuildings: number;
  buildingIds: readonly number[];
  thumbnail: ThisWeekScreenThumbnail;
}

export type ThisWeekScreenEmptyLine = 'today' | 'thisWeek';

export interface ThisWeekScreenSection {
  group: ThisWeekGroupId;
  rows: readonly ThisWeekScreenRow[];
  emptyLine: ThisWeekScreenEmptyLine | null;
}

export type ThisWeekScreenFeed =
  | { kind: 'empty' }
  | {
      kind: 'sections';
      sections: readonly ThisWeekScreenSection[];
      nextMonday: number;
      rowCount: number;
    };

export interface ThisWeekScreenRowText {
  row: ThisWeekScreenRow;
  token: string | null;
  when: string;
  qualifier: { text: string; tone: 'urgent' | 'benefit' | 'plain' } | null;
  place: string;
}

export interface ThisWeekScreenSectionText {
  group: ThisWeekGroupId;
  label: string;
  emptyLine: string | null;
  rows: readonly ThisWeekScreenRowText[];
}
