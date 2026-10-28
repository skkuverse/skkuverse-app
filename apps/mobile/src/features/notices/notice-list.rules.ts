import { kstDate, msIntoKstDay, MS_PER_DAY } from '@skkuverse/shared';
import type { NoticeListRow, NoticeListRowDay } from './notice-facts.types';
import type { NoticeListItem } from './notices.types';

/** WHY: a separator sees only the entry above it, so whether a line follows is decided here, per entry. */
export type NoticeListEntry =
  | { kind: 'day'; key: string; day: NoticeListRowDay; hasDividerBelow: false }
  | { kind: 'fact'; key: string; item: NoticeListItem; row: NoticeListRow; hasDividerBelow: boolean }
  | { kind: 'plain'; key: string; item: NoticeListItem; hasDividerBelow: boolean };

export interface ToNoticeListEntriesInputs {
  withFacts: boolean;
  sourceCount: number;
}

type UndividedEntry =
  | Extract<NoticeListEntry, { kind: 'day' }>
  | Omit<Extract<NoticeListEntry, { kind: 'fact' }>, 'hasDividerBelow'>
  | Omit<Extract<NoticeListEntry, { kind: 'plain' }>, 'hasDividerBelow'>;

/**
 * WHY: the server sends each row's day and the order, so a header opens wherever a row's day changes; a notice
 * with no row, or a row with no day, stays under the header above it.
 */
export function toNoticeListEntries(
  items: readonly NoticeListItem[],
  { withFacts, sourceCount }: ToNoticeListEntriesInputs,
): NoticeListEntry[] {
  // WHY: the server names the board on every request that lists sources, even one; remove this once it
  // sends `board` only for two or more.
  const showsBoard = sourceCount >= 2;
  const undivided: UndividedEntry[] = [];
  let currentDay: NoticeListRowDay | null = null;
  for (const item of items) {
    const row = withFacts ? item.row : null;
    if (row === null) {
      undivided.push({ kind: 'plain', key: item.id, item });
      continue;
    }
    if (row.day !== null && row.day !== currentDay) {
      undivided.push({ kind: 'day', key: `day:${item.id}`, day: row.day, hasDividerBelow: false });
      currentDay = row.day;
    }
    undivided.push({ kind: 'fact', key: item.id, item, row: showsBoard ? row : { ...row, board: null } });
  }
  return undivided.map((entry, index): NoticeListEntry => {
    if (entry.kind === 'day') return entry;
    const next = undivided[index + 1];
    return { ...entry, hasDividerBelow: next !== undefined && next.kind !== 'day' };
  });
}

export function toNextKstMidnight(now: number): number {
  return now - msIntoKstDay(now) + MS_PER_DAY;
}

/** WHY: a row's day was computed when the server answered, so a page fetched before midnight names the wrong day. */
export function isFromEarlierKstDay(fetchedAt: number, now: number): boolean {
  return fetchedAt > 0 && kstDate(fetchedAt) < kstDate(now);
}
