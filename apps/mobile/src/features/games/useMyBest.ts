import { useQueries, useQuery } from '@tanstack/react-query';
import type { GameId } from './games.constants';
import { leaderboardKey, orderOf, STALE_MS, type BoardReadOptions } from './board-query.rules';
import type { BoardEntry } from './leaderboard.rules';
import { myEntry, rankOf } from './games.repository';

const myBestQuery = (gameId: GameId, uid: string | null, options: BoardReadOptions = {}) => ({
  queryKey: [...leaderboardKey(gameId), 'me', uid],
  enabled: uid !== null,
  queryFn: async (): Promise<{ entry: BoardEntry; rank: number } | null> => {
    const entry = await myEntry(gameId, uid!);
    return entry ? { entry, rank: await rankOf(gameId, orderOf(gameId), entry.score) } : null;
  },
  staleTime: STALE_MS,
  refetchOnMount: options.refetchOnMount ?? true,
});

export function useMyBest(gameId: GameId, uid: string | null, options: BoardReadOptions = {}) {
  return useQuery(myBestQuery(gameId, uid, options));
}

/** WHY: the same reads as `useMyBest`, so the same cache. */
export function useMyBests(gameIds: readonly GameId[], uid: string | null, options: BoardReadOptions = {}) {
  return useQueries({ queries: gameIds.map((id) => myBestQuery(id, uid, options)) });
}
