import { useCallback, useLayoutEffect, useRef, useState, type Dispatch, type RefObject } from 'react';
import { useT } from '@skkuverse/shared';
import type { GameAction } from '@/platform/analytics.types';
import { signInErrorMessageKey, type GoogleSignInErrorCode } from '@/features/auth/auth.service';
import type { SessionEvent, SessionState } from '../host.rules';

interface UseRankPromptInputs {
  sessionRef: RefObject<SessionState>;
  dispatch: Dispatch<SessionEvent>;
  needsFor(s: SessionState): 'signIn' | 'setup' | null;
  signIn(): Promise<GoogleSignInErrorCode | null>;
  pickNickname(): void;
  logGame(action: GameAction, detail?: string): void;
  toTitle(): void;
}

export function useRankPrompt({ sessionRef, dispatch, needsFor, signIn, pickNickname, logGame, toTitle }: UseRankPromptInputs) {
  const { t } = useT();
  const [prompt, setPrompt] = useState<{ variant: 'signIn' | 'setup'; busy: boolean; error: string | null } | null>(null);
  // QUIRK(gorhom-bottom-sheet): `onDismiss` also fires after a close in code, with a handler from a render
  // that still showed the sheet; reading the prompt here tells a late dismiss from a real one.
  const promptRef = useRef(prompt);
  useLayoutEffect(() => {
    promptRef.current = prompt;
  });
  const signInInFlight = useRef(false);
  // WHY: offered once per screen and again only after a new best; asking after every run is nagging.
  const offeredBoard = useRef(false);
  const offerAgain = useCallback(() => {
    offeredBoard.current = false;
  }, []);

  /**
   * WHY: a run that could go on the board after sign-in or a nickname is offered that once; meanwhile it is
   * final (the revive offer stops) but stays on screen, so it can still be written.
   */
  const onNext = () => {
    const s = sessionRef.current;
    logGame('next');
    const needs = needsFor(s);
    if (needs && !offeredBoard.current) {
      offeredBoard.current = true;
      dispatch({ type: 'finalize' });
      setPrompt({ variant: needs, busy: false, error: null });
      logGame('prompt_shown', needs);
      return;
    }
    toTitle();
  };

  const onAccept = async () => {
    if (!prompt) return;
    if (!prompt.busy) logGame('prompt_accept', prompt.variant);
    if (prompt.variant === 'setup') {
      setPrompt(null);
      pickNickname();
      return;
    }
    // QUIRK(react): `busy` disables the button only from the next render, so a second tap in this one would start a
    // second sign-in.
    if (signInInFlight.current) return;
    signInInFlight.current = true;
    setPrompt({ ...prompt, busy: true, error: null });
    const failure = await signIn().finally(() => {
      signInInFlight.current = false;
    });
    if (failure === null) {
      setPrompt(null);
      return;
    }
    const key = signInErrorMessageKey(failure);
    setPrompt((p) => p && { ...p, busy: false, error: key && t(key) });
  };

  const onLater = () => {
    const p = promptRef.current;
    if (!p || p.busy) return;
    logGame('prompt_decline', p.variant);
    setPrompt(null);
    toTitle();
  };

  return { prompt, offerAgain, onNext, onAccept, onLater };
}
