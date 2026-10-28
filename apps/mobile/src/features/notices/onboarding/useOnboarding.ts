import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSemanticColors } from '@skkuverse/sds';
import {
  useSettingsStore,
  useT,
  type Campus,
  authStore,
  withRetry,
} from '@skkuverse/shared';
import { requireSession } from '@/features/auth/auth.service';
import {
  finalizeOnboardingAccepted,
  seedOnboardingPreferences,
} from '@/features/notifications/notifications.service';
import { logHandledError } from '@/platform/crashlytics';
import {
  logOnboardingStep,
  logScreenView,
} from '@/platform/analytics';
import { STEP_KEYS, UNSUPPORTED_DEPT_SURVEY_URL } from './onboarding.constants';
import { initialState, reducer } from './onboarding.rules';
import { decideOnboardingCompletion } from './completion.rules';
import { assembleOnboardingPickerSelections } from './picker-selections.rules';
import { fillProfileIfMissing } from '@/features/profile/profile.service';
import { openInAppBrowser } from '@/platform/handoff';
import { useNoticeTabs } from '../useNoticeTabs';
import type { TabSource } from '../notices.types';
import { useNotificationChoice } from './components/useNotificationChoice';
import { useWizardBack } from './components/useWizardBack';
import { useWizardSignIn } from './components/useWizardSignIn';

export function useOnboarding() {
  const router = useRouter();
  const { t } = useT();
  const color = useSemanticColors();
  // WHY: `skipLogin` is decided once, at mount. A live `isAnonymous` flips the moment step 4
  // succeeds, which would re-route NEXT and PREV mid-wizard.
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const auth = authStore.getState();
    const signedIn = !auth.isAnonymous && !!auth.uid;
    return {
      ...initialState,
      skipLogin: signedIn,
      // WHY: a skipped login never dispatches SET_USER, so step 7 would greet the generic fallback name.
      userName: signedIn ? (auth.displayName ?? '') : null,
    };
  });

  useEffect(() => {
    const key = STEP_KEYS[state.step];
    if (key) {
      logScreenView(`onboarding_${key}`);
      logOnboardingStep({ step: key, action: 'enter' });
    }
  }, [state.step]);

  const {
    data: tabsConfig,
    isLoading: tabsLoading,
    isError: tabsError,
    refetch: refetchTabs,
  } = useNoticeTabs();
  const deptList: TabSource[] = useMemo(() => {
    // WHY: the server-side functions kept outside this repository use 'dept' too, so a rename is one coordinated change.
    const deptTab = tabsConfig?.tabs.find((t) => t.key === 'dept');
    return deptTab?.picker?.sources ?? [];
  }, [tabsConfig]);

  const { showExitDialog, setShowExitDialog, handleBack, handleLeave } = useWizardBack(
    state.step,
    dispatch,
  );
  const { loginLoading, loginError, handleSignIn } = useWizardSignIn(dispatch);
  const { handleEnable, handleSkipNotifications } = useNotificationChoice({
    campus: state.campus,
    primaryDeptId: state.primaryDeptId,
    interestDeptIds: state.interestDeptIds,
    tabsConfig,
    dispatch,
  });

  // WHY: `completeOnboarding()` opens the gate only after the Firestore write succeeds; the reverse
  // order left a ghost state (local done, no server doc) where the dept picker failed forever.
  const handleComplete = useCallback(async () => {
    if (!state.campus) return;
    logOnboardingStep({ step: 'completion', action: 'complete' });
    const campus: Campus = state.campus;

    // WHY: asking for the session also retries a lost anonymous sign-in, so the next tap usually finds one.
    const session = requireSession();
    const uid = 'uid' in session ? session.uid : null;
    const decision = decideOnboardingCompletion({
      uid,
      notificationsAccepted: state.notificationsAccepted,
    });

    if (decision === 'abort-no-uid' || !uid) {
      // WHY: no uid is a failed write, never a fall-through to completeOnboarding (the ghost state).
      // No later self-heal fixes it: Android's linkWithCredential keeps the uid, so onAuthStateChanged never fires.
      logHandledError(
        'onboarding/complete-no-uid',
        new Error('uid null at onboarding completion'),
      );
      const message = 'reason' in session ? session.messageKey : 'onboarding.seedErrorMessage';
      Alert.alert(t('onboarding.seedErrorTitle'), t(message));
      return;
    }

    const picker =
      state.seededPickerSelections ??
      assembleOnboardingPickerSelections({
        campus,
        primaryDeptId: state.primaryDeptId,
        interestDeptIds: state.interestDeptIds,
        tabsConfig,
      });
    try {
      if (decision === 'finalize') {
        await withRetry(() => finalizeOnboardingAccepted(uid, picker));
      } else {
        await withRetry(() =>
          seedOnboardingPreferences(uid, picker, {
            enabled: false,
            finalize: true,
          }),
        );
      }
    } catch (err) {
      logHandledError('onboarding/finalize', err);
      Alert.alert(
        t('onboarding.seedErrorTitle'),
        t('onboarding.seedErrorMessage'),
      );
      return;
    }

    // WHY: reaching here means the Firestore write succeeded; never move this call above the branches.
    useSettingsStore.getState().completeOnboarding({
      campus,
      primaryDeptId: state.primaryDeptId,
      interestDeptIds: state.interestDeptIds,
    });
    fillProfileIfMissing(uid, { campus });

    router.dismissAll();
  }, [
    state.campus,
    state.primaryDeptId,
    state.interestDeptIds,
    state.notificationsAccepted,
    state.seededPickerSelections,
    router,
    tabsConfig,
    t,
  ]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const handleSkipInterests = useCallback(() => {
    logOnboardingStep({ step: 'interest_dept', action: 'clear_interest_depts' });
    dispatch({ type: 'CLEAR_INTEREST_DEPTS' });
    dispatch({ type: 'NEXT' });
  }, []);

  // WHY: the browser's result is ignored; closing it is itself the decision to skip.
  const handleUnsupportedDept = useCallback(async () => {
    logOnboardingStep({ step: 'primary_dept', action: 'go_dept_survey' });
    await openInAppBrowser(UNSUPPORTED_DEPT_SURVEY_URL, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: color.fg.brand,
      toolbarColor: color.bg.layerDefault,
      dismissButtonStyle: 'close',
      showTitle: true,
      enableBarCollapsing: true,
    });
    dispatch({ type: 'SKIP_PRIMARY_DEPT' });
    dispatch({ type: 'NEXT' });
  }, [color]);

  const ctaDisabled = (() => {
    switch (state.step) {
      case 1: return state.campus === null;
      case 2: return state.primaryDeptId === null;
      case 3: return state.interestDeptIds.length === 0;
      default: return false;
    }
  })();

  const ctaLabel = (() => {
    switch (state.step) {
      case 5: return t('onboarding.notificationCta');
      case 7: return t('onboarding.completionCta');
      default: return t('onboarding.next');
    }
  })();

  const onCtaPress = (() => {
    switch (state.step) {
      case 4: return handleSignIn;
      case 5: return handleEnable;
      case 7: return handleComplete;
      default: return handleNext;
    }
  })();

  return {
    state,
    dispatch,
    tabsLoading,
    tabsError,
    refetchTabs,
    deptList,
    loginLoading,
    loginError,
    showExitDialog,
    setShowExitDialog,
    handleBack,
    handleLeave,
    handleSignIn,
    handleSkipInterests,
    handleSkipNotifications,
    handleUnsupportedDept,
    ctaDisabled,
    ctaLabel,
    onCtaPress,
  };
}
