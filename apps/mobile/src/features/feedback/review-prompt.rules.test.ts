/**
 * Pins the review-prompt gate: install age, the positive-review kill-switch
 * and the 90-day cooldown per reason.
 */
import { describe, expect, it } from 'vitest';
import { NINETY_DAYS_MS, SEVEN_DAYS_MS, THREE_DAYS_MS } from './feedback.constants';
import { shouldShowReviewPrompt } from './review-prompt.rules';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_760_000_000_000;

type GateState = Parameters<typeof shouldShowReviewPrompt>[0];

function state(overrides: Partial<GateState> = {}): GateState {
  return {
    firstLaunchAt: NOW - 30 * DAY,
    hasGivenPositiveReview: false,
    reviewPromptHistory: {},
    ...overrides,
  };
}

describe('shouldShowReviewPrompt', () => {
  it.each([
    ['no first launch recorded', state({ firstLaunchAt: 0 }), 3 * DAY, false],
    ['an install younger than the minimum age', state({ firstLaunchAt: NOW - 2 * DAY }), 3 * DAY, false],
    ['an install exactly the minimum age', state({ firstLaunchAt: NOW - 3 * DAY }), 3 * DAY, true],
    ['a longer minimum age not yet reached', state({ firstLaunchAt: NOW - 5 * DAY }), 7 * DAY, false],
    ['a positive review already given', state({ hasGivenPositiveReview: true }), 3 * DAY, false],
    [
      'shown for this reason inside the cooldown',
      state({ reviewPromptHistory: { bookmark: { lastShownAt: NOW - 90 * DAY + 1, lastOutcome: null } } }),
      3 * DAY,
      false,
    ],
    [
      'shown for this reason exactly at the end of the cooldown',
      state({ reviewPromptHistory: { bookmark: { lastShownAt: NOW - 90 * DAY, lastOutcome: null } } }),
      3 * DAY,
      true,
    ],
    [
      'shown only for another reason',
      state({ reviewPromptHistory: { shuttle: { lastShownAt: NOW - DAY, lastOutcome: null } } }),
      3 * DAY,
      true,
    ],
    ['never shown, old enough', state(), 3 * DAY, true],
  ] as const)('%s', (_name, gate, minAge, expected) => {
    // Act
    const shown = shouldShowReviewPrompt(gate, 'bookmark', NOW, minAge);

    // Assert
    expect(shown).toBe(expected);
  });

  it('names the thresholds callers pass: three, seven and ninety days', () => {
    // Assert
    expect([THREE_DAYS_MS, SEVEN_DAYS_MS, NINETY_DAYS_MS]).toEqual([3 * DAY, 7 * DAY, 90 * DAY]);
  });

  it('defaults the minimum install age to three days', () => {
    // Act
    const atTwoDays = shouldShowReviewPrompt(state({ firstLaunchAt: NOW - 2 * DAY }), 'bookmark', NOW);
    const atThreeDays = shouldShowReviewPrompt(state({ firstLaunchAt: NOW - 3 * DAY }), 'bookmark', NOW);

    // Assert
    expect([atTwoDays, atThreeDays]).toEqual([false, true]);
  });
});
