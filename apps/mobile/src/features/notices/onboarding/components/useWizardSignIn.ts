import { useCallback, useRef, useState, type Dispatch } from 'react';
import { useT } from '@skkuverse/shared';
import {
  signInErrorCode,
  signInErrorMessageKey,
  type GoogleSignInErrorCode,
  signInWithDeviceMigration,
} from '@/features/auth/auth.service';
import { logOnboardingStep } from '@/platform/analytics';
import type { OnboardingAction } from '../onboarding.types';

// WHY: the funnel already charts these `detail` values; a different string breaks its series.
const ONBOARDING_ERROR_DETAIL: Partial<Record<GoogleSignInErrorCode, string>> = {
  DOMAIN_NOT_ALLOWED: 'domain_not_allowed',
  CANCELLED: 'cancelled',
};

export function useWizardSignIn(dispatch: Dispatch<OnboardingAction>) {
  const { t } = useT();
  const [loginLoading, setLoginLoading] = useState(false);
  // WHY: a ref, not state: two taps in one render both read state as false, and Android then
  // rejects the first flow with IN_PROGRESS while the second flow's sheet is still open.
  const signInInFlight = useRef(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // WHY: no `classifyAndRestoreOnboarding` here; the wizard always writes a fresh seed, even over
  // an onboarded user. A returning user restores from the landing's or the login screen's entry.
  const handleSignIn = useCallback(async () => {
    if (signInInFlight.current) return;
    signInInFlight.current = true;
    try {
      setLoginLoading(true);
      setLoginError(null);
      logOnboardingStep({ step: 'login', action: 'signin_attempt' });
      const user = await signInWithDeviceMigration('onboarding');
      logOnboardingStep({ step: 'login', action: 'signin_success' });
      dispatch({ type: 'SET_USER', name: user.displayName ?? '' });
      dispatch({ type: 'NEXT' });
    } catch (err) {
      const code = signInErrorCode(err);
      logOnboardingStep({
        step: 'login',
        action: 'signin_error',
        detail: ONBOARDING_ERROR_DETAIL[code] ?? code,
      });
      // WHY: the domain case keeps the wizard's own headline; every other failure says what went wrong.
      const key = signInErrorMessageKey(code);
      if (code === 'DOMAIN_NOT_ALLOWED') setLoginError(t('onboarding.oauthErrorTitle'));
      else if (key) setLoginError(t(key));
    } finally {
      signInInFlight.current = false;
      setLoginLoading(false);
    }
  }, [t, dispatch]);

  return { loginLoading, loginError, handleSignIn };
}
