import { useEffect, useMemo, useState } from 'react';
import { useT } from '@skkuverse/shared';
import type { ProfileState } from '@/features/profile/useUserProfile';
import type { GameId } from '../../games.constants';
import { FIRST_PARTY_GAMES } from '../../registry.rules';
import { useRankOf } from '../../useRankOf';
import type { SessionState } from '../host.rules';
import { toPredictedScore, toResultLine, toResultNote, type PlacedEntry } from './result-line.rules';

const PROMOTE_DELAY_MS = 450;

interface UseResultLineInputs {
  gameId: GameId;
  session: SessionState;
  panelVisible: boolean;
  myBest: PlacedEntry | null;
  uid: string | null;
  email: string | null;
  profile: ProfileState;
}

/**
 * WHY: the panel opens on the player's old place and a beat later the line moves, so a new best climbs on
 * screen. One key throughout (written best, predicted best, or a ghost while it cannot be written), so it moves.
 */
export function useResultLine({ gameId, session, panelVisible, myBest, uid, email, profile }: UseResultLineInputs) {
  const { t, tpl } = useT();
  const { score: { order }, leaderboard } = FIRST_PARTY_GAMES[gameId];
  const ranked = leaderboard !== null;
  const { over, submission } = session;
  // WHY: the board re-reads the best once the new one is written, which would take away the line's starting
  // place, so it is kept in step during render only while the crash is unsettled.
  const [before, setBefore] = useState<PlacedEntry | null>(null);
  if (session.phase === 'crashed' && submission.status === 'idle' && before !== myBest) {
    setBefore(myBest);
  }
  const predictedRank = useRankOf(gameId, toPredictedScore({ over, submission, before, myBest, order, ranked })).data ?? null;

  const [promoted, setPromoted] = useState(false);
  if (!panelVisible && promoted) setPromoted(false);
  useEffect(() => {
    if (!panelVisible) return;
    const id = setTimeout(() => setPromoted(true), PROMOTE_DELAY_MS);
    return () => clearTimeout(id);
  }, [panelVisible, over]);

  const player = profile.status === 'ready' ? profile.profile : null;
  return useMemo(() => {
    const inputs = { over, submission, before, myBest, order, ranked, promoted, predictedRank, uid, profile: player, email };
    return { me: toResultLine(inputs), note: toResultNote(inputs, t, tpl) };
  }, [over, submission, before, myBest, order, ranked, promoted, predictedRank, uid, player, email, t, tpl]);
}
