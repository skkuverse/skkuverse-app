/** WHY: every day is a KST calendar day derived from the epoch, and `now` is an argument (umbrella ADR 0010). */

import {
  KST_OFFSET_MS,
  MS_PER_DAY,
  MS_PER_MINUTE,
  formatKstDate,
  formatKstTime,
  type Campus,
  type TranslationKey,
} from '@skkuverse/shared';
import { TITLE_LIMIT, TOKEN_TITLE_LIMIT, toRowTitle, toShortTitle } from './short-title.rules';
import type {
  ThisWeekGroupId,
  ThisWeekItem,
  ThisWeekOperationVerb,
  ThisWeekScreenDay,
  ThisWeekScreenFeed,
  ThisWeekScreenQualifier,
  ThisWeekScreenRow,
  ThisWeekScreenRowText,
  ThisWeekScreenSection,
  ThisWeekScreenSectionText,
  ThisWeekScreenThumbnail,
  ThisWeekScreenToken,
  ThisWeekScreenWhen,
  ThisWeekSession,
  ThisWeekThumbnailFrame,
} from './this-week.types';

type Translate = (key: TranslationKey) => string;
type Template = (key: TranslationKey, ...args: (string | number)[]) => string;

/**
 * WHY: where the gate is closed, the same sheet and detents with no body and the plain campus name, so a
 * store build shows neither the feed nor a stand-in for it, and no screen reader names it.
 */
export function mapRootSheetOf(open: boolean): { body: 'feed' | null; label: TranslationKey } {
  return open ? { body: 'feed', label: 'thisWeek.a11y.sheet' } : { body: null, label: 'map.sheet.a11y.root' };
}

export const SHEET_ROWS = 5;

const MS_PER_HOUR = 60 * MS_PER_MINUTE;

const RANGE_AFTER_MS = MS_PER_DAY + MS_PER_HOUR;

/** WHY: a long range under way since before today sits at the end of this week's group, never today's (D3). */
const LONG_RANGE_MS = 7 * MS_PER_DAY;

const TIMED_DEFAULT_MS = 2 * MS_PER_HOUR;

const CLOSED_TITLE = /\(마감\)|모집마감/;

function kstDayOf(epoch: number): number {
  return Math.floor((epoch + KST_OFFSET_MS) / MS_PER_DAY);
}

export function toKstDayStart(epoch: number): number {
  return kstDayOf(epoch) * MS_PER_DAY - KST_OFFSET_MS;
}

export function toNextMonday(now: number): number {
  const weekday = new Date(now + KST_OFFSET_MS).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return toKstDayStart(now) + (7 - daysSinceMonday) * MS_PER_DAY;
}

function toDay(epoch: number, now: number): ThisWeekScreenDay {
  switch (kstDayOf(epoch) - kstDayOf(now)) {
    case 0:
      return { kind: 'today' };
    case 1:
      return { kind: 'tomorrow' };
    default:
      return { kind: 'date', at: epoch };
  }
}

export function toSessionEnd(session: ThisWeekSession): number {
  if (session.endAt !== null && session.endAt > session.startAt) return session.endAt;
  return session.startAt + (session.timeKnown ? TIMED_DEFAULT_MS : MS_PER_DAY);
}

export function isClosedTitle(title: string): boolean {
  return CLOSED_TITLE.test(title);
}

export type ThisWeekSignUpState =
  | { kind: 'open'; closesAt: number | null }
  | { kind: 'before'; opensAt: number }
  | { kind: 'closed' };

/**
 * WHY: an event's window counts only if it closes before the event starts, since one that closes later
 * opens an admission or a program (umbrella ADR 0010 D2).
 */
export function decideSignUp(item: ThisWeekItem, eventStart: number, now: number): ThisWeekSignUpState | null {
  if (isClosedTitle(item.title)) return { kind: 'closed' };
  if (item.signUp.status !== 'dated') return null;
  const own =
    item.kind === 'call'
      ? item.signUp.windows
      : item.signUp.windows.filter((w) => w.endAt !== null && w.endAt <= eventStart);
  if (own.length === 0) return null;
  const open = own.filter((w) => (w.startAt === null || w.startAt <= now) && (w.endAt === null || w.endAt > now));
  if (open.length > 0) {
    const ends = open.flatMap((w) => (w.endAt === null ? [] : [w.endAt]));
    return { kind: 'open', closesAt: ends.length > 0 ? Math.min(...ends) : null };
  }
  const later = own.flatMap((w) => (w.startAt !== null && w.startAt > now ? [w.startAt] : []));
  if (later.length > 0) return { kind: 'before', opensAt: Math.min(...later) };
  return { kind: 'closed' };
}

function toLiveSessions(item: ThisWeekItem, now: number, horizon: number): ThisWeekSession[] {
  const seen = new Set<string>();
  return item.sessions.filter((s) => {
    if (toSessionEnd(s) <= now || s.startAt >= horizon) return false;
    const key = `${s.startAt}|${s.places.map((p) => p.buildingName).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isInPool(item: ThisWeekItem, campus: Campus, now: number): boolean {
  if (item.campus !== campus || item.kind === 'job' || item.kind === 'staff') return false;
  const live = toLiveSessions(item, now, toNextMonday(now) + 7 * MS_PER_DAY);
  if (live.length === 0) return false;
  return !(item.kind === 'call' && decideSignUp(item, live[0].startAt, now)?.kind === 'closed');
}

function toOperationVerb(name: string): ThisWeekOperationVerb {
  if (name.includes('휴무')) return 'closed';
  if (name.includes('단축')) return 'shortHours';
  if (name.includes('운행')) return 'running';
  return 'open';
}

export function decideWhen(
  item: ThisWeekItem,
  next: ThisWeekSession,
  now: number,
  inToday: boolean,
): ThisWeekScreenWhen {
  const end = toSessionEnd(next);
  const lastDay = toDay(end - 1, now);
  const ongoing = next.startAt <= now;
  const isRange = end - next.startAt > RANGE_AFTER_MS;
  if (item.kind === 'operation') {
    const verb = toOperationVerb(next.name);
    if (ongoing) return { kind: 'operation', verb, from: null, to: lastDay };
    return { kind: 'operation', verb, from: toDay(next.startAt, now), to: isRange ? lastDay : null };
  }
  if (isRange) return ongoing ? { kind: 'through', to: lastDay } : { kind: 'range', from: toDay(next.startAt, now), to: lastDay };
  if (ongoing) return next.timeKnown ? { kind: 'onNow', until: end } : { kind: 'day', day: { kind: 'today' } };
  if (!next.timeKnown) return { kind: 'day', day: toDay(next.startAt, now) };
  return { kind: 'start', day: inToday ? null : toDay(next.startAt, now), at: next.startAt };
}

function isEndOfDay(at: number): boolean {
  const minute = Math.floor((at - toKstDayStart(at)) / MS_PER_MINUTE);
  return minute === 0 || minute === 24 * 60 - 1;
}

export function decideQualifier(
  item: ThisWeekItem,
  signUp: ThisWeekSignUpState | null,
  room: string | null,
  now: number,
): ThisWeekScreenQualifier | null {
  if (item.restriction) return { kind: 'restriction', audience: item.restriction };
  if (signUp?.kind === 'open' && signUp.closesAt !== null) {
    const endOfDay = isEndOfDay(signUp.closesAt);
    // WHY: a window that ends at midnight closes the day before.
    const last = endOfDay && signUp.closesAt === toKstDayStart(signUp.closesAt) ? signUp.closesAt - 1 : signUp.closesAt;
    const daysLeft = kstDayOf(last) - kstDayOf(now);
    // WHY: line 2 holds 26 characters (ADR 0009 D3), so only today's deadline spends them on its hour.
    return { kind: 'signUpCloses', day: toDay(last, now), at: endOfDay || daysLeft > 0 ? null : signUp.closesAt, urgent: daysLeft <= 1 };
  }
  if (signUp?.kind === 'before') return { kind: 'signUpOpens', day: toDay(signUp.opensAt, now) };
  if (item.benefit) return { kind: 'benefit', text: item.benefit };
  if (room) return { kind: 'room', room };
  return null;
}

export function decideToken(item: ThisWeekItem, signUp: ThisWeekSignUpState | null): ThisWeekScreenToken | null {
  if (item.kind === 'call') return signUp === null || (signUp.kind === 'open' && signUp.closesAt === null) ? 'recruiting' : null;
  return signUp?.kind === 'closed' ? 'signUpClosed' : null;
}

export function toThumbnail(item: ThisWeekItem, failed: boolean): ThisWeekScreenThumbnail {
  if (item.imageUrl && !failed) return { kind: 'image', url: item.imageUrl };
  return { kind: 'icon', itemKind: item.kind === 'operation' || item.kind === 'call' ? item.kind : 'event' };
}

/**
 * WHY: laid out here, not by expo-image's `contentPosition`: a sheet that changes width lays its rows out
 * every frame, each pass drops that offset until the image reloads, and the poster flickers.
 */
export function toThumbnailFrame(aspectRatio: number | null): ThisWeekThumbnailFrame {
  if (aspectRatio === null) return { kind: 'pending' };
  return aspectRatio > 0 && aspectRatio < 1 ? { kind: 'portrait', aspectRatio } : { kind: 'cover' };
}

interface Placed {
  row: ThisWeekScreenRow;
  group: ThisWeekGroupId;
  sortAt: number;
  tail: boolean;
}

function toPlaced(item: ThisWeekItem, now: number, nextMonday: number): Placed {
  const live = toLiveSessions(item, now, nextMonday + 7 * MS_PER_DAY);
  const next = live[0];
  const ongoing = next.startAt <= now;
  const sortAt = ongoing ? now : next.startAt;
  const tail = ongoing && toSessionEnd(next) - next.startAt > LONG_RANGE_MS && next.startAt < toKstDayStart(now);
  const group: ThisWeekGroupId = tail
    ? 'thisWeek'
    : sortAt < toKstDayStart(now) + MS_PER_DAY
      ? 'today'
      : sortAt < nextMonday
        ? 'thisWeek'
        : 'nextWeek';
  const places = live.flatMap((s) => s.places);
  const buildings = [...new Set(places.map((p) => p.buildingName))];
  const room = places.find((p) => p.buildingName === buildings[0])?.room ?? null;
  const signUp = decideSignUp(item, next.startAt, now);
  const token = decideToken(item, signUp);
  const row: ThisWeekScreenRow = {
    item,
    token,
    title: toRowTitle(item.shortTitle ?? toShortTitle(item.title), token === null ? TITLE_LIMIT : TOKEN_TITLE_LIMIT),
    when: decideWhen(item, next, now, group === 'today'),
    moreSessions: live.length - 1,
    qualifier: decideQualifier(item, signUp, room, now),
    building: buildings[0],
    moreBuildings: buildings.length - 1,
    buildingIds: [...new Set(places.flatMap((p) => (p.skkuId === null ? [] : [p.skkuId])))],
    thumbnail: toThumbnail(item, false),
  };
  return { row, group, sortAt, tail };
}

const GROUPS: readonly ThisWeekGroupId[] = ['today', 'thisWeek', 'nextWeek'];

function byStartThenTitle(a: Placed, b: Placed): number {
  if (a.tail !== b.tail) return a.tail ? 1 : -1;
  if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
  return a.row.title < b.row.title ? -1 : a.row.title > b.row.title ? 1 : 0;
}

export function toThisWeekFeed(items: readonly ThisWeekItem[], campus: Campus, now: number): ThisWeekScreenFeed {
  const nextMonday = toNextMonday(now);
  const placed = items
    .filter((item) => isInPool(item, campus, now))
    .map((item) => toPlaced(item, now, nextMonday))
    .sort(byStartThenTitle);
  if (placed.length === 0) return { kind: 'empty' };
  const rowsOf = (group: ThisWeekGroupId) => placed.filter((p) => p.group === group).map((p) => p.row);
  const [today, thisWeek, nextWeek] = GROUPS.map(rowsOf);
  const sections: ThisWeekScreenSection[] = [];
  if (today.length === 0 && thisWeek.length === 0) {
    sections.push({ group: 'thisWeek', rows: [], emptyLine: 'thisWeek' });
  } else {
    sections.push({ group: 'today', rows: today, emptyLine: today.length === 0 ? 'today' : null });
    if (thisWeek.length > 0) sections.push({ group: 'thisWeek', rows: thisWeek, emptyLine: null });
  }
  if (nextWeek.length > 0) sections.push({ group: 'nextWeek', rows: nextWeek, emptyLine: null });
  return { kind: 'sections', sections, nextMonday, rowCount: placed.length };
}

/** WHY: an empty-state line always shows, since it leads. */
export function toSheetFeed(feed: ThisWeekScreenFeed): { feed: ThisWeekScreenFeed; hasMore: boolean; moreCount: number } {
  if (feed.kind === 'empty') return { feed, hasMore: false, moreCount: 0 };
  let left = SHEET_ROWS;
  const sections: ThisWeekScreenSection[] = [];
  for (const section of feed.sections) {
    if (section.emptyLine !== null) {
      sections.push(section);
      continue;
    }
    if (left === 0) break;
    const rows = section.rows.slice(0, left);
    left -= rows.length;
    sections.push({ ...section, rows });
  }
  const shown = SHEET_ROWS - left;
  return { feed: { ...feed, sections, rowCount: shown }, hasMore: feed.rowCount > shown, moreCount: feed.rowCount - shown };
}

export function toBuildingCounts(feed: ThisWeekScreenFeed): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  if (feed.kind === 'empty') return counts;
  for (const section of feed.sections) {
    for (const row of section.rows) {
      for (const id of row.buildingIds) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
    }
  }
  return counts;
}

function toDayText(day: ThisWeekScreenDay, t: Translate): string {
  switch (day.kind) {
    case 'today':
      return t('thisWeek.today');
    case 'tomorrow':
      return t('thisWeek.tomorrow');
    case 'date':
      return formatKstDate(day.at, t);
  }
}

function toTimeText(at: number, tpl: Template): string {
  const minutes = Math.floor((at - toKstDayStart(at)) / MS_PER_MINUTE);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0 ? tpl('thisWeek.time.hour', hour) : `${hour}:${String(minute).padStart(2, '0')}`;
}

const OPERATION_VERBS: Readonly<Record<ThisWeekOperationVerb, TranslationKey>> = {
  closed: 'thisWeek.operation.closed',
  shortHours: 'thisWeek.operation.shortHours',
  running: 'thisWeek.operation.running',
  open: 'thisWeek.operation.open',
};

export function toWhenText(when: ThisWeekScreenWhen, t: Translate, tpl: Template): string {
  switch (when.kind) {
    case 'start':
      return when.day === null
        ? tpl('thisWeek.when.start', toTimeText(when.at, tpl))
        : tpl('thisWeek.when.startOn', toDayText(when.day, t), toTimeText(when.at, tpl));
    case 'day':
      return tpl('thisWeek.when.day', toDayText(when.day, t));
    case 'range':
      return tpl('thisWeek.when.range', toDayText(when.from, t), toDayText(when.to, t));
    case 'through':
      return tpl('thisWeek.when.through', toDayText(when.to, t));
    case 'onNow':
      return tpl('thisWeek.when.onNow', formatKstTime(when.until));
    case 'operation': {
      const verb = t(OPERATION_VERBS[when.verb]);
      if (when.from === null) return tpl('thisWeek.when.operationThrough', toDayText(when.to ?? { kind: 'today' }, t), verb);
      if (when.to === null) return tpl('thisWeek.when.operationOn', toDayText(when.from, t), verb);
      return tpl('thisWeek.when.operationRange', toDayText(when.from, t), toDayText(when.to, t), verb);
    }
  }
}

export function toWhenLine(row: ThisWeekScreenRow, t: Translate, tpl: Template): string {
  const when = toWhenText(row.when, t, tpl);
  return row.moreSessions > 0 ? `${when} ${tpl('thisWeek.when.moreSessions', row.moreSessions)}` : when;
}

/** WHY: the view draws the benefit's gift emoji, in Tossface. */
export function toQualifierText(qualifier: ThisWeekScreenQualifier, t: Translate, tpl: Template): string {
  switch (qualifier.kind) {
    case 'restriction':
      return tpl('thisWeek.qualifier.restriction', qualifier.audience);
    case 'signUpCloses':
      return qualifier.at === null
        ? tpl('thisWeek.qualifier.signUpCloses', toDayText(qualifier.day, t))
        : tpl('thisWeek.qualifier.signUpClosesAt', toDayText(qualifier.day, t), toTimeText(qualifier.at, tpl));
    case 'signUpOpens':
      return tpl('thisWeek.qualifier.signUpOpens', toDayText(qualifier.day, t));
    case 'benefit':
      return qualifier.text;
    case 'room':
      return qualifier.room;
  }
}

export function toTokenText(token: ThisWeekScreenToken, t: Translate): string {
  return t(token === 'signUpClosed' ? 'thisWeek.token.signUpClosed' : 'thisWeek.token.recruiting');
}

/** WHY: a room beside its building reads as an address, and line 2 keeps its width for the date. */
export function toPlaceText(row: ThisWeekScreenRow, tpl: Template): string {
  const where = row.qualifier?.kind === 'room' ? tpl('thisWeek.place.room', row.building, row.qualifier.room) : row.building;
  return row.moreBuildings > 0 ? tpl('thisWeek.place.more', where, row.moreBuildings) : where;
}

export function toGroupLabelText(group: ThisWeekGroupId, nextMonday: number, t: Translate, tpl: Template): string {
  switch (group) {
    case 'today':
      return t('thisWeek.today');
    case 'thisWeek':
      return tpl('thisWeek.group.thisWeek', formatKstDate(nextMonday - MS_PER_DAY, t));
    case 'nextWeek':
      return tpl('thisWeek.group.nextWeek', formatKstDate(nextMonday, t));
  }
}

export function toEmptyLineText(line: 'today' | 'thisWeek', t: Translate): string {
  return t(line === 'today' ? 'thisWeek.empty.today' : 'thisWeek.empty.thisWeek');
}

export function toRowText(row: ThisWeekScreenRow, t: Translate, tpl: Template): ThisWeekScreenRowText {
  const q = row.qualifier;
  return {
    row,
    token: row.token === null ? null : toTokenText(row.token, t),
    when: toWhenLine(row, t, tpl),
    qualifier:
      q === null || q.kind === 'room'
        ? null
        : {
            text: toQualifierText(q, t, tpl),
            tone: q.kind === 'benefit' ? 'benefit' : q.kind === 'signUpCloses' && q.urgent ? 'urgent' : 'plain',
          },
    place: toPlaceText(row, tpl),
  };
}

export function toSectionTexts(feed: ThisWeekScreenFeed, t: Translate, tpl: Template): ThisWeekScreenSectionText[] {
  if (feed.kind === 'empty') return [];
  return feed.sections.map((section) => ({
    group: section.group,
    label: toGroupLabelText(section.group, feed.nextMonday, t, tpl),
    emptyLine: section.emptyLine === null ? null : toEmptyLineText(section.emptyLine, t),
    rows: section.rows.map((row) => toRowText(row, t, tpl)),
  }));
}
