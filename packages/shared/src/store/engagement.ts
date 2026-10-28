import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';

/**
 * QUIRK(ios): the native review prompt's result is unobservable from JS, so this is what the user
 * tapped in the app's own sheet.
 */
export type ReviewPromptOutcome = 'positive' | 'negative' | 'dismissed';

/**
 * WHY: keyed by surface, so declining one does not silence another; a positive outcome is global
 * (`hasGivenPositiveReview`) and never stored here.
 */
export interface ReviewPromptHistoryEntry {
  lastShownAt: number;
  lastOutcome: 'negative' | 'dismissed' | null;
}

export interface EngagementState {
  /** WHY: 0 is the unset sentinel; stamped once, never updated. */
  firstLaunchAt: number;
  hasGivenPositiveReview: boolean;
  reviewPromptHistory: Record<string, ReviewPromptHistoryEntry>;
  injaShuttleVisitCount: number;
  /** WHY: tells a return from the schedule screen apart from an unrelated tab focus; session-only. */
  shuttlePromptArmed: boolean;
}

interface EngagementActions {
  initFirstLaunchIfNeeded: () => void;
  markPromptShown: (reason: string) => void;
  setOutcome: (reason: string, outcome: ReviewPromptOutcome) => void;
  incrementInjaShuttleVisit: () => void;
  consumeShuttleArm: () => void;
}

export type EngagementStore = EngagementState & EngagementActions;

/**
 * WHY: kept apart from the settings store, so these signals change shape without forcing a settings
 * `migrate` branch.
 */
export const useEngagementStore = create<EngagementStore>()(
  persist(
    (set, get) => ({
      firstLaunchAt: 0,
      hasGivenPositiveReview: false,
      reviewPromptHistory: {},
      injaShuttleVisitCount: 0,
      shuttlePromptArmed: false,

      initFirstLaunchIfNeeded: () => {
        if (get().firstLaunchAt === 0) {
          set({ firstLaunchAt: Date.now() });
        }
      },

      markPromptShown: (reason) =>
        set((s) => ({
          reviewPromptHistory: {
            ...s.reviewPromptHistory,
            [reason]: {
              lastShownAt: Date.now(),
              lastOutcome: s.reviewPromptHistory[reason]?.lastOutcome ?? null,
            },
          },
        })),

      setOutcome: (reason, outcome) => {
        if (outcome === 'positive') {
          // WHY: a positive outcome on any surface ends the prompt on every surface.
          set({ hasGivenPositiveReview: true });
        } else {
          set((s) => ({
            reviewPromptHistory: {
              ...s.reviewPromptHistory,
              [reason]: {
                lastShownAt: s.reviewPromptHistory[reason]?.lastShownAt ?? Date.now(),
                lastOutcome: outcome,
              },
            },
          }));
        }
      },

      incrementInjaShuttleVisit: () =>
        set((s) => ({
          injaShuttleVisitCount: s.injaShuttleVisitCount + 1,
          shuttlePromptArmed: true,
        })),

      consumeShuttleArm: () => set({ shuttlePromptArmed: false }),
    }),
    {
      name: 'engagement',
      version: 3,
      migrate: (persisted, version) => {
        const next = { ...(persisted as Record<string, unknown>) };

        if (version < 2) {
          delete next.delightedBookmarkCount;
        }

        if (version < 3) {
          type OldOutcome = 'positive' | 'negative' | 'dismissed' | null | undefined;
          const oldOutcome = next.reviewPromptOutcome as OldOutcome;
          const oldLastShownAt = next.lastReviewPromptAt as number | null | undefined;

          next.hasGivenPositiveReview = oldOutcome === 'positive';

          const history: Record<string, ReviewPromptHistoryEntry> = {};
          if (oldLastShownAt != null) {
            history['second_bookmark'] = {
              lastShownAt: oldLastShownAt,
              lastOutcome:
                oldOutcome === 'positive' || oldOutcome == null ? null : oldOutcome,
            };
          }
          next.reviewPromptHistory = history;
          next.injaShuttleVisitCount = 0;
          next.shuttlePromptArmed = false;

          delete next.reviewPromptOutcome;
          delete next.lastReviewPromptAt;
        }

        return next as unknown as EngagementStore;
      },
      // WHY: `shuttlePromptArmed` is session-only.
      partialize: (state) => ({
        firstLaunchAt: state.firstLaunchAt,
        hasGivenPositiveReview: state.hasGivenPositiveReview,
        reviewPromptHistory: state.reviewPromptHistory,
        injaShuttleVisitCount: state.injaShuttleVisitCount,
      }),
      storage: createJSONStorage(() => mmkvStateStorage),
    },
  ),
);
