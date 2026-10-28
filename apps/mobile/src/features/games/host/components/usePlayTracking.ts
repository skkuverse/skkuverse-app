import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { track } from '@/platform/analytics';
import type { GameAction } from '@/platform/analytics.types';
import type { EntrySource } from '@/platform/analytics.rules';
import { bumpUsage } from '@/platform/usage-counters';
import type { GameId } from '../../games.constants';
import {
  buildGameEndParams,
  flushSubmitLog,
  initialSubmitLog,
  trackSubmit,
  type GameOver,
  type SessionState,
} from '../host.rules';

interface Play {
  id: string;
  startedAt: number;
  bgMs: number;
  bgSince: number | null;
}

const bgMsOf = (p: Play, now: number) => p.bgMs + (p.bgSince === null ? 0 : now - p.bgSince);

/**
 * WHY: one play is one `game:start` (a revive carries it on), timed by the host's clock, with time out of the app
 * counted apart.
 */
export function usePlayTracking({ gameId, source, session }: { gameId: GameId; source: EntrySource; session: SessionState }) {
  const play = useRef<Play | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const p = play.current;
      if (p && state !== 'active' && p.bgSince === null) p.bgSince = Date.now();
      if (p && state === 'active' && p.bgSince !== null) {
        p.bgMs += Date.now() - p.bgSince;
        p.bgSince = null;
      }
    });
    return () => sub.remove();
  }, []);

  const logGame = useCallback(
    (action: GameAction, detail?: string) => {
      track('game_action', { game_id: gameId, play_id: play.current?.id, action, detail });
    },
    [gameId],
  );

  const startPlay = useCallback(() => {
    const id = Math.random().toString(36).slice(2, 10);
    play.current = { id, startedAt: Date.now(), bgMs: 0, bgSince: null };
    track('game_start', { game_id: gameId, play_id: id, play_n: bumpUsage(`game:${gameId}`), source });
  }, [gameId, source]);

  const endPlay = useCallback(
    (over: GameOver) => {
      const p = play.current;
      if (!p) return;
      const now = Date.now();
      track('game_end', buildGameEndParams({ gameId, playId: p.id, over, wallMs: now - p.startedAt, bgMs: bgMsOf(p, now) }));
    },
    [gameId],
  );

  // WHY: reported once nothing can change it; a network failure the player may still retry is held back until the
  // run is dropped.
  const submitLog = useRef(initialSubmitLog);
  useEffect(() => {
    const { log, reports } = trackSubmit(submitLog.current, session, play.current?.id ?? null);
    submitLog.current = log;
    for (const report of reports) track('game_submit', { game_id: gameId, ...report });
  }, [session, gameId]);
  useEffect(
    () => () => {
      for (const report of flushSubmitLog(submitLog.current)) track('game_submit', { game_id: gameId, ...report });
      submitLog.current = initialSubmitLog;
    },
    [gameId],
  );

  return { logGame, startPlay, endPlay };
}
