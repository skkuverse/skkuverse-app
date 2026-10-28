import { useCallback, useEffect, useState, type Dispatch } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { logOnboardingStep } from '@/platform/analytics';
import { STEP_KEYS } from '../onboarding.constants';
import type { OnboardingAction, OnboardingStep } from '../onboarding.types';

export function useWizardBack(step: OnboardingStep, dispatch: Dispatch<OnboardingAction>) {
  const router = useRouter();
  const [showExitDialog, setShowExitDialog] = useState(false);

  // QUIRK(react-native): the exit dialog is an in-tree overlay, not a native Modal, so BACK reaches
  // this handler while it is open, and there BACK means "stay", like the dimmer.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showExitDialog) {
        setShowExitDialog(false);
        return true;
      }
      if (step === 7) return true;
      if (step === 1) {
        setShowExitDialog(true);
        return true;
      }
      dispatch({ type: 'PREV' });
      return true;
    });
    return () => handler.remove();
  }, [step, showExitDialog, dispatch]);

  const handleBack = useCallback(() => {
    const key = STEP_KEYS[step];
    if (step === 1) {
      if (key) logOnboardingStep({ step: key, action: 'exit_cancel' });
      setShowExitDialog(true);
    } else {
      if (key) logOnboardingStep({ step: key, action: 'back' });
      dispatch({ type: 'PREV' });
    }
  }, [step, dispatch]);

  const handleLeave = useCallback(() => {
    const key = STEP_KEYS[step];
    if (key) logOnboardingStep({ step: key, action: 'exit_leave' });
    setShowExitDialog(false);
    router.back();
  }, [router, step]);

  return { showExitDialog, setShowExitDialog, handleBack, handleLeave };
}
