import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { GameId } from './games.constants';
import { leaderboardKey } from './board-query.rules';

export function useInvalidateLeaderboard(gameId: GameId) {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: leaderboardKey(gameId) }), [queryClient, gameId]);
}
