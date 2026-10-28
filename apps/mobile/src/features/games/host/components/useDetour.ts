import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';

export interface Detour {
  state: 'none' | 'away' | 'back';
  step: 'signIn' | 'setup' | null;
  runId: string | null;
}

const NO_DETOUR: Detour = { state: 'none', step: null, runId: null };

export function useDetour(input: { runOnScreen(): string | null; canDecide: boolean; onBackFromNickname(): void }) {
  const { runOnScreen, canDecide, onBackFromNickname } = input;
  const router = useRouter();
  const isFocused = useIsFocused();
  /**
   * WHY: it belongs to the run on screen when it began, so a later run never inherits it; the same step on return
   * means backed out.
   */
  const [detour, setDetour] = useState<Detour>(NO_DETOUR);
  const [awaitingNickname, setAwaitingNickname] = useState(false);
  const leftRef = useRef(false);

  const pickNickname = useCallback(() => {
    setAwaitingNickname(true);
    setDetour({ state: 'away', step: 'setup', runId: runOnScreen() });
    leftRef.current = false;
    router.push({ pathname: '/profile-setup', params: { nickname: '1' } } as never);
  }, [router, runOnScreen]);

  const backFromSignIn = useCallback(() => setDetour({ state: 'back', step: 'signIn', runId: runOnScreen() }), [runOnScreen]);

  // WHY: decided again once, when this screen is in front and the profile and best are read for whoever is signed
  // in now.
  useEffect(() => {
    if (!awaitingNickname) return;
    if (!isFocused) {
      leftRef.current = true;
      return;
    }
    if (!leftRef.current || !canDecide) return;
    setAwaitingNickname(false);
    setDetour((prev) => ({ state: 'back', step: 'setup', runId: prev.runId }));
    onBackFromNickname();
  }, [awaitingNickname, isFocused, canDecide, onBackFromNickname]);

  const resetDetour = useCallback(() => setDetour(NO_DETOUR), []);

  return { detour, pickNickname, backFromSignIn, resetDetour };
}
