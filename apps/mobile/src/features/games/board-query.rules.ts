import type { GameId } from './games.constants';
import { FIRST_PARTY_GAMES } from './registry.rules';

/** WHY: every key starts with ['leaderboard', gameId], so one invalidation after a write refreshes every board. */
export const STALE_MS = 30_000;

export const orderOf = (gameId: GameId) => FIRST_PARTY_GAMES[gameId].score.order;

export const leaderboardKey = (gameId: GameId) => ['leaderboard', gameId] as const;

/**
 * WHY: off for a board that remounts without the player asking (a carousel page), or each mount of stale data reads
 * the board again.
 */
export interface BoardReadOptions {
  refetchOnMount?: boolean;
}
