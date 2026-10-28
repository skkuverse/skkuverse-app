/**
 * The prototype's weeks and the counts the shared map draws inside the
 * building circles: one set per week and campus, read by the host for both
 * tabs, and only on a prerelease build.
 */

import { describe, expect, it } from 'vitest';
import { CAMPUSES } from '@skkuverse/shared';
import { buildingCountsFor } from '../components/canvas/number-circle.rules';
import { THIS_WEEK_BUILDING_COUNTS, THIS_WEEK_WEEK_IDS, THIS_WEEK_WEEKS } from './this-week.constants';
import { toBuildingCounts, toThisWeekFeed } from './this-week.rules';

describe('THIS_WEEK_WEEKS: the frozen weeks', () => {
  it.each(THIS_WEEK_WEEK_IDS)('reads %s whole, at its Monday 09:00 cut', (id) => {
    // Act
    const week = THIS_WEEK_WEEKS[id];

    // Assert
    expect(week.now).toBe(Date.parse(`${id}T09:00:00+09:00`));
    expect(week.items.length).toBeGreaterThan(0);
  });
});

describe('THIS_WEEK_BUILDING_COUNTS: the building circles’ counts on both tabs', () => {
  it('is each week’s page counted per campus, one constant set per week', () => {
    for (const id of THIS_WEEK_WEEK_IDS) {
      for (const campus of CAMPUSES) {
        // Arrange
        const week = THIS_WEEK_WEEKS[id];

        // Act
        const counts = THIS_WEEK_BUILDING_COUNTS[id][campus];

        // Assert
        expect(counts).toStrictEqual(toBuildingCounts(toThisWeekFeed(week.items, campus, week.now)));
        expect(THIS_WEEK_BUILDING_COUNTS[id][campus]).toBe(counts);
      }
    }
  });

  it('reaches the building layer on a prerelease build and never on a store build', () => {
    for (const campus of CAMPUSES) {
      // Arrange
      const counts = THIS_WEEK_BUILDING_COUNTS['2026-10-26'][campus];

      // Act & Assert
      expect(buildingCountsFor(true, counts)).toBe(counts);
      expect(buildingCountsFor(false, counts).size).toBe(0);
    }
  });
});
