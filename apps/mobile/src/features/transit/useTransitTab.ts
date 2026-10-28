import { useCallback, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useEngagementStore, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/features/web/web.service';
import { firstTransitTapMs, track } from '@/platform/analytics';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { DEV_ALWAYS_SHOW, SEVEN_DAYS_MS } from '@/features/feedback/feedback.constants';
import { useTransitGroups } from './components/useTransitGroups';
import { useTransitLoadError } from './components/useTransitLoadError';
import { useTransitLayout } from './useTransitLayout';
import type { TransitRowItem } from './transit.types';

const SHUTTLE_VISIT_THRESHOLD = 3;

export function useTransitTab({ reviewIcon }: { reviewIcon: ReactNode }) {
  const { t } = useT();
  const { data, isLoading, isError, refetch } = useTransitLayout();
  const groups = useTransitGroups();
  const loadError = useTransitLoadError('transit_tab', undefined, !isLoading && (isError || !data), refetch);

  const openRow = (item: TransitRowItem, sectionId: string, groupId?: string) => {
    // WHY: the opened surface logs its own open; this event is only which row was tapped.
    track('transit_item_tap', {
      item_id: item.id,
      kind: item.kind,
      section_id: sectionId,
      group_id: groupId,
      launch_ms: firstTransitTapMs(Date.now()),
    });
    // WHY: the action alone decides where a row goes, never its kind.
    handleSduiAction({ ...item.action, source: 'tab' });
  };

  const review = useReviewPrompt({
    reason: 'inja_shuttle',
    minInstallAgeMs: SEVEN_DAYS_MS,
    title: t('feedback.reviewPrompt.shuttleTitle'),
    icon: reviewIcon,
  });

  /**
   * WHY: `useReviewPrompt` returns a new `review` object every render, so the stable function is destructured.
   */
  const { triggerIfEligible: triggerShuttleReview } = review;

  /**
   * WHY: `useFocusEffect` fires on every focus, so the armed flag (set on schedule mount, consumed here)
   * confirms a schedule screen was visited.
   */
  useFocusEffect(
    useCallback(() => {
      const store = useEngagementStore.getState();
      const eligible =
        DEV_ALWAYS_SHOW ||
        (store.shuttlePromptArmed && store.injaShuttleVisitCount >= SHUTTLE_VISIT_THRESHOLD);
      if (eligible) {
        triggerShuttleReview(store.injaShuttleVisitCount);
      }
      store.consumeShuttleArm();
    }, [triggerShuttleReview]),
  );

  return { data, isLoading, isError, groups, loadError, openRow, reviewHost: review.host };
}
