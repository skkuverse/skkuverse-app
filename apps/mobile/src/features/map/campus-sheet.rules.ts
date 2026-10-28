/** WHY: pure, so `campus-sheet.rules.test.mts` runs under plain `node --test`. */

/**
 * WHY: percent, not a fraction: `0.24 * 100` is 24.000000000000004 and would reach the sheet as that literal.
 * The top detent is `large`, which `Sheet` resolves from the container, not a percentage.
 */
export type CampusSheetPercents = readonly [small: number, medium: number];

export interface CampusSheetDetents {
  percents: CampusSheetPercents;
  initial: 'small' | 'medium';
}

const FLOOR_PERCENT = 24;

const MEDIUM_PERCENT = 42;

export const CAMPUS_SHEET_DETENTS: CampusSheetDetents = {
  percents: [FLOOR_PERCENT, MEDIUM_PERCENT],
  initial: 'small',
};
