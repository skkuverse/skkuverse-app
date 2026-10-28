import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useT } from '@skkuverse/shared';
import {
  signInErrorAppCheck,
  signInErrorClass,
  signInErrorCode,
  signInErrorMessageKey,
  signInWithDeviceMigration,
  classifyAndRestoreOnboarding,
} from './auth.service';
import { logAuthEvent } from '@/platform/analytics';

export function useLogin() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // WHY: a ref, not state: two taps in one render both read state as false, and Android then
  // rejects the first flow with IN_PROGRESS while the second flow's sheet is still open.
  const inFlight = useRef(false);

  const handleSignIn = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setLoading(true);
      setErrorMessage(null);
      logAuthEvent({ event: 'signin_attempt', surface: 'login_screen' });
      const user = await signInWithDeviceMigration('login');
      logAuthEvent({ event: 'signin_success', surface: 'login_screen' });
      const result = await classifyAndRestoreOnboarding(user.uid, 'login');
      switch (result.kind) {
        case 'restored':
        case 'read-failed':
          // WHY: on read-failed useAppInit's onPreferencesChanged listener unlocks the gate soon, so
          // returning to the caller beats a toast.
          router.back();
          break;
        case 'new':
          // WHY: replace drops the login screen, so the wizard's dismissAll returns to the caller.
          router.replace('/onboarding');
          break;
      }
    } catch (err) {
      const code = signInErrorCode(err);
      if (code === 'CANCELLED') {
        logAuthEvent({ event: 'signin_cancel', surface: 'login_screen' });
      } else if (code === 'DOMAIN_NOT_ALLOWED') {
        logAuthEvent({ event: 'signin_domain_rejected', surface: 'login_screen' });
      } else {
        logAuthEvent({
          event: 'signin_error',
          surface: 'login_screen',
          detail: code === 'PLAY_SERVICES_UNAVAILABLE' ? 'play_services' : code,
          cls: signInErrorClass(code),
          ac_kind: signInErrorAppCheck(err)?.kind,
        });
      }
      const key = signInErrorMessageKey(code);
      if (key) setErrorMessage(t(key));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return { loading, errorMessage, handleSignIn };
}
