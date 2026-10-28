/**
 * Holding a sheet's list at an offset below the top detent, where gorhom
 * locks the list: the hold is written into gorhom's own lock, as a drag on
 * the sheet's handle writes the offset it started from.
 */

import { describe, expect, it } from 'vitest';
import { holdLockAt, type ScrollLockContext } from './list-hold.rules';

/** The offset gorhom's lock puts the list back to (`useScrollEventsHandlersDefault`). */
const lockOffsetOf = (context: ScrollLockContext) =>
  context.shouldLockInitialPosition ? (context.initialContentOffsetY ?? 0) : 0;

describe('holdLockAt', () => {
  it("makes gorhom's lock put the list back to the held offset rather than its top", () => {
    // Arrange
    const context: ScrollLockContext = { shouldLockInitialPosition: false, initialContentOffsetY: 0 };

    // Act
    holdLockAt(context, 640);

    // Assert
    expect(lockOffsetOf(context)).toBe(640);
  });

  it('replaces the offset a handle drag captured before', () => {
    // Arrange
    const context: ScrollLockContext = { shouldLockInitialPosition: true, initialContentOffsetY: 120 };

    // Act
    holdLockAt(context, 0);

    // Assert
    expect(lockOffsetOf(context)).toBe(0);
  });
});
