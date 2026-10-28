import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@skkuverse/shared';
import type { GameId } from './games.constants';
import { leaderboardKey, orderOf, STALE_MS, type BoardReadOptions } from './board-query.rules';
import { topEntries } from './games.repository';

/** WHY: reading needs a signed-in user (anonymous is enough), so it waits until there is one. */
export function useBoardTop(gameId: GameId, limit: number, options: BoardReadOptions = {}) {
  const signedIn = useAuthStore((s) => s.uid !== null);
  return useQuery({
    queryKey: [...leaderboardKey(gameId), 'top', limit],
    enabled: signedIn,
    queryFn: () => topEntries(gameId, orderOf(gameId), limit),
    staleTime: STALE_MS,
    refetchOnMount: options.refetchOnMount ?? true,
  });
}
