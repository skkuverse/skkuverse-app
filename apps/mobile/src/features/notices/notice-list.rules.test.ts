/**
 * How the list lays out the server's rows: a day header wherever a row's day
 * changes, in the server's order across page seams; a notice without a row as
 * today's row under the header above it; the board only on a list of several
 * sources; and a divider only between two rows. Plus the KST day edge that
 * makes a cached page's days stale.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import listRows from './__fixtures__/notice-list-rows.json';
import { isFromEarlierKstDay, toNextKstMidnight, toNoticeListEntries, type NoticeListEntry } from './notice-list.rules';
import type { NoticeListRowDay } from './notice-facts.types';
import { multiSourceNoticePageSchema } from './notices.schema';
import type { NoticeListItem } from './notices.types';

const [fixtureItem] = parseOrThrow(multiSourceNoticePageSchema, listRows.data, 'notices.multiPage').notices;

function notice(id: string, day: NoticeListRowDay | null | 'none'): NoticeListItem {
  return {
    ...fixtureItem,
    id,
    row: day === 'none' ? null : { ...fixtureItem.row!, day },
  };
}

const shape = (entries: NoticeListEntry[]) =>
  entries.map((entry) => (entry.kind === 'day' ? `[${entry.day}]` : `${entry.key}${entry.hasDividerBelow ? '|' : ''}`));

const facts = { withFacts: true, sourceCount: 2 };

describe('toNoticeListEntries', () => {
  it('opens a header wherever the day changes, with a divider only between two rows', () => {
    // Arrange
    const items = [notice('a', 'today'), notice('b', 'today'), notice('c', 'yesterday'), notice('d', 'earlier')];

    // Act
    const entries = toNoticeListEntries(items, facts);

    // Assert
    expect(shape(entries)).toStrictEqual(['[today]', 'a|', 'b', '[yesterday]', 'c', '[earlier]', 'd']);
  });

  it('keeps one header across a page seam, since it runs over the flattened pages', () => {
    // Arrange
    const firstPage = [notice('a', 'thisWeek'), notice('b', 'thisWeek')];
    const secondPage = [notice('c', 'thisWeek'), notice('d', 'earlier')];

    // Act
    const entries = toNoticeListEntries([...firstPage, ...secondPage], facts);

    // Assert
    expect(shape(entries)).toStrictEqual(['[thisWeek]', 'a|', 'b|', 'c', '[earlier]', 'd']);
  });

  it('puts a notice without a row, or a row without a day, under the header above it', () => {
    // Arrange
    const items = [notice('lead', 'none'), notice('a', 'today'), notice('b', 'none'), notice('c', null), notice('d', 'yesterday')];

    // Act
    const entries = toNoticeListEntries(items, facts);

    // Assert
    expect(shape(entries)).toStrictEqual(['lead', '[today]', 'a|', 'b|', 'c', '[yesterday]', 'd']);
    expect(entries.map((entry) => entry.kind)).toStrictEqual(['plain', 'day', 'fact', 'plain', 'fact', 'day', 'fact']);
  });

  it('lays out every notice as today has it when the facts are off', () => {
    // Arrange
    const items = [notice('a', 'today'), notice('b', 'yesterday'), notice('c', 'none')];

    // Act
    const entries = toNoticeListEntries(items, { withFacts: false, sourceCount: 2 });

    // Assert
    expect(shape(entries)).toStrictEqual(['a|', 'b|', 'c']);
    expect(entries.every((entry) => entry.kind === 'plain')).toBe(true);
  });

  it.each([
    [0, null],
    [1, null],
    [2, '학부통합(학사)'],
  ])('shows the board on a list of %i sources as %s', (sourceCount, board) => {
    // Act
    const [, entry] = toNoticeListEntries([notice('a', 'today')], { withFacts: true, sourceCount });

    // Assert
    expect(entry?.kind === 'fact' ? entry.row.board : 'not a row').toBe(board);
  });

  it('lays out an empty list as no entries', () => {
    // Act & Assert
    expect(toNoticeListEntries([], facts)).toStrictEqual([]);
  });
});

describe('the KST day edge', () => {
  // 2026-10-28 23:30 KST is 14:30 UTC the same date; 2026-10-29 00:10 KST is 15:10 UTC on the 28th.
  const lateOn28 = Date.parse('2026-10-28T14:30:00Z');
  const earlyOn29 = Date.parse('2026-10-28T15:10:00Z');

  it('names the next KST midnight, not the UTC one', () => {
    // Act & Assert
    expect(toNextKstMidnight(lateOn28)).toBe(Date.parse('2026-10-28T15:00:00Z'));
    expect(toNextKstMidnight(earlyOn29)).toBe(Date.parse('2026-10-29T15:00:00Z'));
  });

  it.each([
    ['a page fetched before KST midnight, read after it', lateOn28, earlyOn29, true],
    ['a page fetched the same KST day', earlyOn29 - 60_000, earlyOn29, false],
    ['a placeholder page with no fetch time', 0, earlyOn29, false],
  ])('%s is from an earlier day: %s', (_name, fetchedAt, now, expected) => {
    // Act & Assert
    expect(isFromEarlierKstDay(fetchedAt, now)).toBe(expected);
  });
});
