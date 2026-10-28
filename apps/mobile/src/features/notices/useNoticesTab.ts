import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore, useSettingsStore, useT } from '@skkuverse/shared';
import {
  signInErrorCode,
  signInErrorMessageKey,
  signInWithDeviceMigration,
  classifyAndRestoreOnboarding,
} from '@/features/auth/auth.service';
import { showsOnboardingLanding } from './notices.rules';

export function useNoticesTab() {
  const router = useRouter();
  const { t } = useT();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // WHY: a ref, not state: two taps in one render both read state as false, and Android then
  // rejects the first flow with IN_PROGRESS while the second flow's sheet is still open.
  const signInInFlight = useRef(false);

  // WHY: one half of a dual write; restoreOnboardingFromPreferences, run by useAppInit's preferences
  // listener, restores the same 'dept' mirror. Both are required: this one closes the flicker window
  // right after sign-in. Never change one alone.
  async function handleExistingAccountSignIn() {
    if (signInInFlight.current) return;
    signInInFlight.current = true;
    try {
      setSigningIn(true);
      setSignInError(null);
      const user = await signInWithDeviceMigration('notices');
      const result = await classifyAndRestoreOnboarding(user.uid, 'notices');
      switch (result.kind) {
        case 'restored':
          break;
        case 'read-failed':
          setSignInError(t('error.network'));
          break;
        case 'new':
          router.push('/onboarding');
          break;
      }
    } catch (err) {
      const key = signInErrorMessageKey(signInErrorCode(err));
      if (key) setSignInError(t(key));
    } finally {
      signInInFlight.current = false;
      setSigningIn(false);
    }
  }

  return {
    showsLanding: showsOnboardingLanding({ isAnonymous, onboardingCompleted }),
    openOnboarding: () => router.push('/onboarding'),
    handleExistingAccountSignIn,
    signingIn,
    signInError,
  };
}
