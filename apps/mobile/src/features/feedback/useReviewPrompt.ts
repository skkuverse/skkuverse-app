import { useCallback, useRef, useState, type ReactNode } from 'react';
import { type SheetRef } from '@skkuverse/sds';
import { useEngagementStore, useT } from '@skkuverse/shared';
import { submitNegativeFeedback } from './feedback.repository';
import type { ReviewPromptHostProps } from './ReviewPromptHost';
import { requestNativeReview } from '@/platform/store-review';
import {
  logReviewPromptDismissed,
  logReviewPromptNegative,
  logReviewPromptPositive,
  logReviewPromptShown,
} from '@/platform/analytics';
import { DEV_ALWAYS_SHOW } from './feedback.constants';
import { shouldShowReviewPrompt } from './review-prompt.rules';

export interface UseReviewPromptOptions {
  // WHY: stable across versions, since it is the analytics `reason`, the per-surface cooldown key and the feedback `source`.
  reason: string;
  minInstallAgeMs: number;
  title: string;
  icon: ReactNode;
  resolveContext?: () => { sourceId: string; articleNo: number };
}

export interface UseReviewPromptReturn {
  triggerIfEligible: (count: number) => void;
  host: ReviewPromptHostProps;
}

/**
 * WHY: a positive answer on any surface sets `hasGivenPositiveReview`, a global kill-switch;
 * a negative or dismissed one only starts that surface's 90-day cooldown in `reviewPromptHistory[reason]`.
 */
export function useReviewPrompt({
  reason,
  minInstallAgeMs,
  title,
  icon,
  resolveContext,
}: UseReviewPromptOptions): UseReviewPromptReturn {
  const { t } = useT();
  const helpfulSheetRef = useRef<SheetRef>(null);
  const feedbackSheetRef = useRef<SheetRef>(null);

  // QUIRK(gorhom-bottom-sheet): `onDismiss` fires for a swipe-close and for the dismiss after a choice alike, so this ref stops a made choice from also recording 'dismissed'.
  const explicitOutcomeRef = useRef<'positive' | 'negative' | null>(null);

  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const setOutcome = useEngagementStore((s) => s.setOutcome);
  const markPromptShown = useEngagementStore((s) => s.markPromptShown);

  const triggerIfEligible = useCallback(
    (count: number) => {
      const store = useEngagementStore.getState();
      if (!DEV_ALWAYS_SHOW && !shouldShowReviewPrompt(store, reason, Date.now(), minInstallAgeMs)) {
        return;
      }
      markPromptShown(reason);
      logReviewPromptShown({ reason, count });
      explicitOutcomeRef.current = null;
      helpfulSheetRef.current?.present?.();
    },
    [reason, minInstallAgeMs, markPromptShown],
  );

  const handlePositive = useCallback(() => {
    explicitOutcomeRef.current = 'positive';
    setOutcome(reason, 'positive');
    logReviewPromptPositive({ reason });
    void requestNativeReview(reason);
  }, [reason, setOutcome]);

  const handleNegative = useCallback(() => {
    explicitOutcomeRef.current = 'negative';
    // WHY: no 'negative' outcome yet, so the funnel tells a thumbs-down that submitted text from one that bailed.
    feedbackSheetRef.current?.present?.();
  }, []);

  const handleDismiss = useCallback(() => {
    if (explicitOutcomeRef.current !== null) return;
    setOutcome(reason, 'dismissed');
    logReviewPromptDismissed({ reason });
  }, [reason, setOutcome]);

  const handleFeedbackSubmit = useCallback(
    (text: string) => {
      setIsFeedbackSubmitting(true);
      const context = resolveContext?.();
      void submitNegativeFeedback({
        source: reason,
        text,
        noticeRef: context,
      })
        .then((success) => {
          if (!success) {
            // WHY: no outcome here, so a submit that never wrote a doc does not inflate the submit count.
            setToastText(t('feedback.reviewPrompt.retry'));
            return;
          }
          setOutcome(reason, 'negative');
          logReviewPromptNegative({ reason, hasText: text.length > 0 });
          feedbackSheetRef.current?.dismiss?.();
          setShowThanks(true);
        })
        .finally(() => setIsFeedbackSubmitting(false));
    },
    [reason, resolveContext, setOutcome, t],
  );

  const handleFeedbackDismiss = useCallback(() => {
    // WHY: a bail records 'negative' too, so the per-surface cooldown applies.
    const history = useEngagementStore.getState().reviewPromptHistory[reason];
    if (history?.lastOutcome == null) {
      setOutcome(reason, 'negative');
      logReviewPromptNegative({ reason, hasText: false });
    }
  }, [reason, setOutcome]);

  const closeThanks = () => setShowThanks(false);
  const clearToast = () => setToastText(null);

  const host: ReviewPromptHostProps = {
    helpfulSheetRef,
    feedbackSheetRef,
    icon,
    title,
    isFeedbackSubmitting,
    showThanks,
    toastText,
    onPositive: handlePositive,
    onNegative: handleNegative,
    onDismiss: handleDismiss,
    onFeedbackSubmit: handleFeedbackSubmit,
    onFeedbackDismiss: handleFeedbackDismiss,
    closeThanks,
    clearToast,
  };

  return { triggerIfEligible, host };
}
