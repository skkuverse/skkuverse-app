import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { useAuthStore } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { logAuthEvent, track } from '@/platform/analytics';
import {
  classifyAndRestoreOnboarding,
  signInWithDeviceMigration,
  GoogleAuthError,
  signInErrorAppCheck,
  signInErrorClass,
  type GoogleSignInErrorCode,
} from '@/features/auth/auth.service';
import { getProfile } from '@/features/profile/profile.repository';
import type { ProfileState } from '@/features/profile/useUserProfile';
import type { GameId } from '../../games.constants';
import { emailPrefixOf, isBetter } from '../../leaderboard.rules';
import { FIRST_PARTY_GAMES } from '../../registry.rules';
import { useInvalidateLeaderboard } from '../../useInvalidateLeaderboard';
import { useMyBest } from '../../useMyBest';
import {
  buildEntry,
  canRetrySubmit,
  decideSubmit,
  isFinal,
  isStalledOn,
  submitValidator,
  type SessionEvent,
  type SessionState,
  type EntryFields,
  type SubmitDecision,
} from '../host.rules';
import { claimRunOver, submitResult } from '../host.service';
import { useDetour } from './useDetour';

/**
 * WHY: a signed-in player with a nickname does nothing; a new best is written the moment the run is final.
 * Otherwise the screen asks once, after "next", and coming back to the same step means they backed out.
 */
export function useAutoSubmit(input: {
  gameId: GameId;
  session: SessionState;
  dispatch: Dispatch<SessionEvent>;
  profile: ProfileState;
}) {
  const { gameId, session, dispatch, profile } = input;
  const invalidate = useInvalidateLeaderboard(gameId);
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const email = useAuthStore((s) => s.email);
  const signedIn = !!uid && !isAnonymous;
  const { score: { order }, leaderboard } = FIRST_PARTY_GAMES[gameId];
  const myBest = useMyBest(gameId, signedIn && leaderboard ? uid : null);

  const attempted = useRef(new Set<string>());
  /** WHY: a retry sends exactly this again, which the server answers as written; held for this screen only. */
  const lastSent = useRef<{ runId: string; entry: EntryFields; validator: string | null } | null>(null);
  // WHY: sign-in and the nickname detour read it after awaits; written in a layout effect, not during render.
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });
  // WHY: the uid changes before `claimRun` has moved the run, and deciding in between would call the run someone
  // else's.
  const [signingIn, setSigningIn] = useState(false);

  const decide = useCallback(
    (s: SessionState): SubmitDecision => {
      if (!leaderboard) return { kind: 'noRun' };
      return decideSubmit({
        uid,
        isAnonymous,
        emailPrefix: emailPrefixOf(email),
        run: s.run,
        profile: profile.status === 'ready' ? profile.profile : null,
        score: s.over?.score ?? 0,
        myBest: myBest.data?.entry.score ?? null,
        better: (a, b) => isBetter(order, a, b),
        maxEntry: leaderboard.maxEntry,
      });
    },
    [uid, isAnonymous, email, profile, myBest.data, order, leaderboard],
  );

  /** WHY: the board is re-read whatever the answer, since a call that timed out may still have committed. */
  const send = useCallback(
    async (sent: { runId: string; entry: EntryFields; validator: string | null }) => {
      const { runId } = sent;
      attempted.current.add(runId);
      lastSent.current = sent;
      const result = await submitResult({ gameId, entry: sent.entry, validator: sent.validator });
      switch (result.kind) {
        case 'submitted':
          dispatch({ type: 'submitted', runId, rank: result.rank });
          break;
        case 'notImproved':
          // WHY: most often a best set on another device that this one had not seen.
          dispatch({ type: 'notImproved', runId });
          break;
        case 'rejected':
          dispatch({ type: 'submitFailed', runId, reason: 'rejected' });
          break;
        case 'network':
          attempted.current.delete(runId);
          dispatch({ type: 'submitFailed', runId, reason: 'network' });
          break;
      }
      void invalidate();
    },
    [dispatch, gameId, invalidate],
  );

  const act = useCallback(
    async (s: SessionState, d: SubmitDecision) => {
      const run = s.run;
      if (!run || !s.over) return;
      switch (d.kind) {
        case 'notImproved':
          dispatch({ type: 'notImproved', runId: run.id });
          return;
        case 'otherAccount':
        case 'rejected':
          dispatch({ type: 'submitFailed', runId: run.id, reason: d.kind });
          return;
        case 'signIn':
        case 'setup':
        case 'noRun':
          return;
        case 'submit': {
          if (!leaderboard || profile.status !== 'ready' || !profile.profile || attempted.current.has(run.id)) return;
          const entry = buildEntry({ uid: uid!, runId: run.id, over: s.over, profile: profile.profile, emailPrefix: emailPrefixOf(email)! });
          dispatch({ type: 'submitStart', runId: run.id });
          await send({ runId: run.id, entry, validator: submitValidator(s.over) });
        }
      }
    },
    [dispatch, profile, uid, email, leaderboard, send],
  );

  /**
   * WHY: not decided again: the board may already hold this result (a timeout that committed), which a fresh
   * decision would call not improved.
   */
  const retry = useCallback(() => {
    const s = sessionRef.current;
    const sent = lastSent.current;
    if (!sent || s.run?.id !== sent.runId || !canRetrySubmit(s) || attempted.current.has(sent.runId)) return;
    dispatch({ type: 'submitRetry', runId: sent.runId });
    void send(sent);
  }, [dispatch, send]);

  const ready = (!signedIn || !myBest.isLoading) && !signingIn;
  useEffect(() => {
    if (!isFinal(session) || session.submission.status !== 'idle' || !ready) return;
    void act(session, decide(session));
  }, [session, ready, decide, act]);

  /**
   * WHY: the screen is about to clear the run, so it settles from this snapshot, waiting for the best rather than
   * dropping it.
   */
  const pendingSettle = useRef<SessionState | null>(null);
  const settleNow = useCallback(
    (finalized: SessionState) => {
      if (finalized.submission.status !== 'idle') return;
      if (!ready || profile.status === 'loading') {
        pendingSettle.current = finalized;
        return;
      }
      void act(finalized, decide(finalized));
    },
    [act, decide, ready, profile.status],
  );
  useEffect(() => {
    const s = pendingSettle.current;
    if (!s || !ready || profile.status === 'loading') return;
    pendingSettle.current = null;
    void act(s, decide(s));
  }, [ready, profile.status, act, decide]);

  const runOnScreen = useCallback(() => sessionRef.current.run?.id ?? null, []);
  const decideOnReturn = useCallback(() => {
    const d = decide(session);
    if (!isStalledOn('setup', d) && isFinal(session) && session.submission.status === 'idle') void act(session, d);
  }, [decide, act, session]);
  const { detour, pickNickname, backFromSignIn, resetDetour } = useDetour({
    runOnScreen,
    canDecide: ready && profile.status !== 'loading',
    onBackFromNickname: decideOnReturn,
  });

  /**
   * WHY: a sign-in that lands on another uid claims the run over first (`claimRun`, the anonymous token as the
   * proof), before any submit decision. Then a player without a nickname goes on to pick one.
   */
  const signIn = useCallback(async (): Promise<GoogleSignInErrorCode | null> => {
    setSigningIn(true);
    try {
      const run = sessionRef.current.run;
      const anon = getAuth().currentUser;
      const anonIdToken = anon?.isAnonymous && run && run.uid === anon.uid ? await getIdToken(anon) : null;
      logAuthEvent({ event: 'signin_attempt', surface: 'game' });
      const user = await signInWithDeviceMigration('game');
      logAuthEvent({ event: 'signin_success', surface: 'game' });
      if (anonIdToken && run && user.uid !== run.uid) {
        const claimed = await claimRunOver(anonIdToken, run.id);
        track('game_action', { game_id: gameId, play_id: run.id, action: claimed ? 'claim_ok' : 'claim_fail' });
        if (claimed) dispatch({ type: 'runArmed', run: { id: run.id, uid: user.uid } });
      }
      await classifyAndRestoreOnboarding(user.uid, 'game');
      const p = await getProfile(user.uid).catch(() => null);
      if (!p?.nickname) pickNickname();
      else backFromSignIn();
      return null;
    } catch (err) {
      // WHY: signInWithGoogle already recorded the failures worth a row.
      const code = err instanceof GoogleAuthError ? err.code : 'UNKNOWN';
      logAuthEvent(
        code === 'CANCELLED'
          ? { event: 'signin_cancel', surface: 'game' }
          : code === 'DOMAIN_NOT_ALLOWED'
            ? { event: 'signin_domain_rejected', surface: 'game' }
            : { event: 'signin_error', surface: 'game', detail: code, cls: signInErrorClass(code), ac_kind: signInErrorAppCheck(err)?.kind },
      );
      if (err instanceof GoogleAuthError) return err.code;
      logHandledError('games/sign-in', err);
      return 'UNKNOWN';
    } finally {
      setSigningIn(false);
    }
  }, [pickNickname, backFromSignIn, dispatch, gameId]);

  const needsFor = useCallback(
    (s: SessionState): 'signIn' | 'setup' | null => {
      // WHY: an unread profile would pass for "no nickname".
      if (s.phase !== 'crashed' || !s.over || profile.status === 'loading' || !ready) return null;
      const d = decide(s);
      return d.kind === 'signIn' || d.kind === 'setup' ? d.kind : null;
    },
    [decide, profile.status, ready],
  );

  return {
    detour,
    resetDetour,
    myBest: myBest.data ?? null,
    needsFor,
    signIn,
    pickNickname,
    settleNow,
    retry,
  };
}
