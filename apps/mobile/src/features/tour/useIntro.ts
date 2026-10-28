import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useT } from '@skkuverse/shared';
import {
  classifyAndRestoreOnboarding,
  signInWithDeviceMigration,
  signInErrorCode,
  signInErrorMessageKey,
  type GoogleSignInErrorCode,
} from '@/features/auth/auth.service';
import { requestProfileSetupIfMissing } from '@/features/profile/profile.service';
import { logIntroStep, logScreenView } from '@/platform/analytics';
import type { IntroStepKey } from '@/platform/analytics.types';

// WHY: the page order, and the analytics key each index reports. IntroScreen.tsx
// renders the same four pages in the same order, so keep the two in step.
const PAGE_KEYS: IntroStepKey[] = ['shuttle', 'map', 'notices', 'login'];

const LOGIN_INDEX = PAGE_KEYS.length - 1;

// WHY: these codes keep their older lower-case analytics `detail`, so the funnel's series continue.
const INTRO_ERROR_DETAIL: Partial<Record<GoogleSignInErrorCode, string>> = {
  DOMAIN_NOT_ALLOWED: 'domain_not_allowed',
  CANCELLED: 'cancelled',
  PLAY_SERVICES_UNAVAILABLE: 'play_services',
};

export function useIntro(onDone: () => void) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // WHY: a ref, not state: two taps in one render both read state as false, and Android then
  // rejects the first flow with IN_PROGRESS while the second flow's sheet is still open.
  const signInInFlight = useRef(false);

  const pageKey = PAGE_KEYS[index] ?? PAGE_KEYS[0]!;

  // WHY: keyed on `index`, so the funnel logs a swipe and a CTA tap alike.
  useEffect(() => {
    const key = PAGE_KEYS[index];
    if (!key) return;
    logScreenView(`intro_${key}`);
    logIntroStep({ step: key, action: 'enter' });
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PAGE_KEYS.length - 1, next));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      setIndex(clamped);
    },
    [width],
  );

  // WHY: on page 1 the OS default (background the app) applies, never onDone(), which would burn
  // the one-shot `seen.intro` flag on an accidental back press.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, goTo]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const handleAdvance = useCallback(() => {
    logIntroStep({ step: pageKey, action: 'advance' });
    goTo(index + 1);
  }, [goTo, index, pageKey]);

  const handleSkip = useCallback(() => {
    logIntroStep({ step: 'login', action: 'skip' });
    onDone();
  }, [onDone]);

  const handleSignIn = useCallback(async () => {
    if (signInInFlight.current) return;
    signInInFlight.current = true;
    try {
      setSigningIn(true);
      setSignInError(null);
      logIntroStep({ step: 'login', action: 'signin_attempt' });
      const user = await signInWithDeviceMigration('intro');
      logIntroStep({ step: 'login', action: 'signin_success' });
      // WHY: called only to restore `onboardedAt` and the dept mirror, so a returning user's notices tab skips
      // the gate with no flicker; its `kind` never routes, the intro just closes.
      await classifyAndRestoreOnboarding(user.uid, 'intro');
      requestProfileSetupIfMissing(user.uid);
      onDone();
    } catch (err) {
      const code = signInErrorCode(err);
      logIntroStep({ step: 'login', action: 'signin_error', detail: INTRO_ERROR_DETAIL[code] ?? code });
      const key = signInErrorMessageKey(code);
      if (key) setSignInError(t(key));
    } finally {
      signInInFlight.current = false;
      setSigningIn(false);
    }
  }, [onDone, t]);

  const onLoginPage = index === LOGIN_INDEX;

  return {
    width,
    scrollRef,
    index,
    pageCount: PAGE_KEYS.length,
    signingIn,
    signInError,
    onLoginPage,
    handleMomentumEnd,
    handleAdvance,
    handleSkip,
    handleSignIn,
  };
}
