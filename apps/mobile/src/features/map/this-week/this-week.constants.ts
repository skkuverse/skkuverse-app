/**
 * WHY: a prototype over two frozen weeks of real notices; the `thisWeekSheet`, `thisWeekPage` and
 * `buildingCounts` gates decide where it shows (`PRERELEASE_GATES`).
 */

import type { Campus } from '@skkuverse/shared';
import busy from './__fixtures__/this-week-2026-10-26.mock.json';
import quiet from './__fixtures__/this-week-2026-10-19.mock.json';
import { toBuildingCounts, toThisWeekFeed } from './this-week.rules';
import { parseThisWeekFeed } from './this-week.schema';
import type { ThisWeekFeed, ThisWeekWeekId } from './this-week.types';

export const THIS_WEEK_DEFAULT_WEEK: ThisWeekWeekId = '2026-10-26';

export const THIS_WEEK_WEEK_IDS: readonly ThisWeekWeekId[] = ['2026-10-26', '2026-10-19'];

const NO_FEED: ThisWeekFeed = { now: 0, items: [] };

export const THIS_WEEK_WEEKS: Readonly<Record<ThisWeekWeekId, ThisWeekFeed>> = {
  '2026-10-26': parseThisWeekFeed(busy) ?? NO_FEED,
  '2026-10-19': parseThisWeekFeed(quiet) ?? NO_FEED,
};

function countsOf(week: ThisWeekFeed): Readonly<Record<Campus, ReadonlyMap<string, number>>> {
  return {
    hssc: toBuildingCounts(toThisWeekFeed(week.items, 'hssc', week.now)),
    nsc: toBuildingCounts(toThisWeekFeed(week.items, 'nsc', week.now)),
  };
}

/** WHY: one map per week and campus for the module's life, so a tab switch never redraws a marker. */
export const THIS_WEEK_BUILDING_COUNTS: Readonly<Record<ThisWeekWeekId, Readonly<Record<Campus, ReadonlyMap<string, number>>>>> = {
  '2026-10-26': countsOf(THIS_WEEK_WEEKS['2026-10-26']),
  '2026-10-19': countsOf(THIS_WEEK_WEEKS['2026-10-19']),
};
