import { useEffect, useRef, type Dispatch, type RefObject } from 'react';
import { AdUnitIds } from '@/platform/ads';
import type { GameAction } from '@/platform/analytics.types';
import { canRevive, type SessionEvent, type SessionState } from '../host.rules';
import type { GameShellHandle } from './GameShell';
import { useRewardedRevive } from './useRewardedRevive';

/** WHY: a revive the ad paid for must bring the run back this soon, or the crash is final. */
const REVIVE_WATCHDOG_MS = 3000;

interface UseReviveOfferInputs {
  revives: boolean;
  session: SessionState;
  sessionRef: RefObject<SessionState>;
  dispatch: Dispatch<SessionEvent>;
  shell: RefObject<GameShellHandle | null>;
  logGame(action: GameAction, detail?: string): void;
}

export function useReviveOffer({ revives, session, sessionRef, dispatch, shell, logGame }: UseReviveOfferInputs) {
  const ad = useRewardedRevive(AdUnitIds.gameRevive, revives);

  // WHY: no ad loaded at the crash means no offer, never a spinning button; the load keeps retrying for the next
  // crash.
  useEffect(() => {
    if (session.offer === 'open' && ad.status !== 'ready') {
      dispatch({ type: 'offerUnavailable' });
      logGame('offer_unavailable', ad.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decided once as the offer opens; an ad status change must not re-run it
  }, [session.offer]);
  useEffect(() => {
    if (session.phase === 'crashed' && ad.status === 'failed') ad.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retries when the run crashes, not on every ad status change
  }, [session.phase]);

  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (watchdog.current) clearTimeout(watchdog.current);
  }, []);

  const onRevive = async () => {
    dispatch({ type: 'reviveStarted' });
    logGame('revive_tap');
    const runId = sessionRef.current.run?.id;
    if (!(await ad.show())) {
      dispatch({ type: 'reviveFailed' });
      logGame('revive_fail', 'ad');
      return;
    }
    if (sessionRef.current.run?.id !== runId) return;
    shell.current?.send({ type: 'revive' });
    logGame('revive_ok');
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => {
      watchdog.current = null;
      if (sessionRef.current.phase === 'crashed') {
        dispatch({ type: 'reviveFailed' });
        logGame('revive_fail', 'watchdog');
      }
    }, REVIVE_WATCHDOG_MS);
  };

  const onExpire = () => {
    dispatch({ type: 'offerExpired' });
    logGame('offer_expired');
  };

  return { enabled: canRevive(session, ad.status === 'ready'), onRevive, onExpire };
}
