import { useQuery } from '@tanstack/react-query';
import type { GameId } from './games.constants';
import { leaderboardKey, orderOf, STALE_MS } from './board-query.rules';
import { rankOf } from './games.repository';

export function useRankOf(gameId: GameId, score: number | null) {
  return useQuery({
    queryKey: [...leaderboardKey(gameId), 'rank', score],
    enabled: score !== null && score > 0,
    queryFn: () => rankOf(gameId, orderOf(gameId), score!),
    staleTime: STALE_MS,
  });
}
