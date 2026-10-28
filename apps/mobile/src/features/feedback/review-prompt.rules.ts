import { type EngagementState } from '@skkuverse/shared';
import { NINETY_DAYS_MS, THREE_DAYS_MS } from './feedback.constants';

/**
 * QUIRK(ios): SKStoreReviewController has a hard 365d/3-prompt quota; the 90d cooldown
 * and the global positive-review kill-switch keep the prompts well inside it.
 */

export function shouldShowReviewPrompt(
  state: Pick<
    EngagementState,
    'firstLaunchAt' | 'hasGivenPositiveReview' | 'reviewPromptHistory'
  >,
  reason: string,
  now: number,
  minInstallAgeMs: number = THREE_DAYS_MS,
): boolean {
  if (state.firstLaunchAt === 0) return false;
  if (now - state.firstLaunchAt < minInstallAgeMs) return false;
  if (state.hasGivenPositiveReview) return false;
  const h = state.reviewPromptHistory[reason];
  if (h?.lastShownAt != null && now - h.lastShownAt < NINETY_DAYS_MS) return false;
  return true;
}
