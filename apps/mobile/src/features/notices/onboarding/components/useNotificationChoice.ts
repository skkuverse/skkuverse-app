import { useCallback, useRef, type Dispatch } from 'react';
import { Alert } from 'react-native';
import {
  useNotificationStore,
  useT,
  type Campus,
  authStore,
  withRetry,
} from '@skkuverse/shared';
import { seedOnboardingPreferences } from '@/features/notifications/notifications.service';
import { checkPermission } from '@/platform/messaging';
import {
  registerCurrentDeviceForNotifications,
  useEnableNotificationsFlow,
} from '@/features/notifications/useEnableNotificationsFlow';
import { logHandledError } from '@/platform/crashlytics';
import { logOnboardingStep } from '@/platform/analytics';
import { assembleOnboardingPickerSelections } from '../picker-selections.rules';
import type { OnboardingAction } from '../onboarding.types';
import type { NoticeTabsConfig } from '../../notices.types';

interface UseNotificationChoiceInputs {
  campus: Campus | null;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  tabsConfig: NoticeTabsConfig | undefined;
  dispatch: Dispatch<OnboardingAction>;
}

export function useNotificationChoice({
  campus,
  primaryDeptId,
  interestDeptIds,
  tabsConfig,
  dispatch,
}: UseNotificationChoiceInputs) {
  const { t } = useT();

  // WHY: advance only after the seed succeeds. Advancing on a failed seed left step 6's toggles
  // failing silently and step 7's finalize hitting NOT_FOUND, a permanently broken wizard.
  const prepareCategoryStepInFlight = useRef(false);
  const prepareCategoryStep = useCallback(async () => {
    if (prepareCategoryStepInFlight.current) return;
    prepareCategoryStepInFlight.current = true;
    try {
      const uid = authStore.getState().uid;
      if (!uid || !campus || !tabsConfig) {
        // WHY: after the login step all three must exist; a silent return leaves only a dead button.
        logHandledError(
          'onboarding/prepare-category-precondition',
          new Error(
            `uid=${!!uid} campus=${!!campus} tabs=${!!tabsConfig}`,
          ),
        );
        return;
      }
      const picker = assembleOnboardingPickerSelections({
        campus,
        primaryDeptId,
        interestDeptIds,
        tabsConfig,
      });
      try {
        // EVIDENCE: the seed is among the app's first Firestore writes and fails on a cold App Check
        // token, mostly on Android's Play Integrity path; withRetry's backoff absorbs it.
        await withRetry(() =>
          seedOnboardingPreferences(uid, picker, {
            enabled: true,
            finalize: false,
          }),
        );
      } catch (err) {
        logHandledError('onboarding/seed-intent', err);
        Alert.alert(t('onboarding.seedErrorTitle'), t('onboarding.seedErrorMessage'));
        return;
      }
      dispatch({ type: 'ACCEPT_NOTIFICATIONS', pickerSelections: picker });
      dispatch({ type: 'NEXT' });
    } finally {
      prepareCategoryStepInFlight.current = false;
    }
  }, [campus, primaryDeptId, interestDeptIds, tabsConfig, t, dispatch]);

  const decline = useCallback(() => {
    dispatch({ type: 'DECLINE_NOTIFICATIONS' });
    // WHY: two NEXTs, 5 to 7: a declined user was never seeded, so step 6 is skipped.
    dispatch({ type: 'NEXT' });
    dispatch({ type: 'NEXT' });
  }, [dispatch]);

  const { handleEnable } = useEnableNotificationsFlow({
    onResolved: ({ granted }) => {
      logOnboardingStep({
        step: 'notification',
        action: granted ? 'permission_grant' : 'permission_deny',
      });
      if (granted) {
        void prepareCategoryStep();
      } else {
        decline();
      }
    },
  });

  // WHY: a granted OS permission still registers the token (master off, so nothing sends). Read
  // the OS status fresh: useAppInit's refresh is gated on onboardingCompleted, so the cache is stale.
  const handleSkipNotifications = useCallback(async () => {
    logOnboardingStep({ step: 'notification', action: 'skip' });
    try {
      const status = await checkPermission();
      useNotificationStore.getState().setPermissionStatus(status);
      if (status === 'authorized' || status === 'provisional') {
        void registerCurrentDeviceForNotifications().catch((err) =>
          logHandledError('onboarding/register-decline-path', err),
        );
      }
    } catch (err) {
      // WHY: a failed check only skips the token registration.
      logHandledError('onboarding/skip-check-permission', err);
    }
    decline();
  }, [decline]);

  return { handleEnable, handleSkipNotifications };
}
