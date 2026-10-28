import type { ImperativeRouter } from 'expo-router';
import { GAME_PROTOCOL } from '@skkuverse/miniapp/protocol';
import { getGameOrigins, queryClient } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import type { GameId } from './games.constants';
import { gameIndexQueryOptions } from './games.client';
import { resolveGameExposure, toGamePage } from './exposure.rules';
import type { GameExposure, GamePage } from './games.types';

export function openLeaderboard(router: ImperativeRouter, gameId: GameId, source: EntrySource): void {
  router.push({ pathname: '/games/[id]/leaderboard', params: { id: gameId, source } } as never);
}

/**
 * WHY: a fresh copy answers at once, a stale one is fetched, and a failed fetch falls back to the cache;
 * with none the registry counts as unreachable. SEE: docs/explanation/in-app-games.md (Opening a game)
 */
export async function resolveGameForOpen(id: GameId): Promise<{ exposure: GameExposure; page: GamePage | null }> {
  const options = gameIndexQueryOptions();
  const index = await queryClient
    .query(options)
    // WHY: a failed query keeps the copy cachedQueryOptions seeded, as a mini-app link does.
    .catch(() => queryClient.getQueryData(options.queryKey) ?? null);
  const exposure = resolveGameExposure(id, { index, hostProtocol: GAME_PROTOCOL });
  return { exposure, page: toGamePage(id, exposure, getGameOrigins()) };
}
