import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GAME_PROTOCOL } from '@skkuverse/miniapp/protocol';
import { getGameOrigins } from '@skkuverse/shared';
import { GAME_IDS, isGameId, type GameId } from './games.constants';
import { gameIndexQueryOptions } from './games.client';
import { resolveGameExposure, toGamePage, toOpenableGameIds } from './exposure.rules';
import type { GameExposure, GamePage, GameRegistryEntry } from './games.types';

const UNKNOWN: GameExposure = { kind: 'unknown' };

function exposureOf(id: string, index: readonly GameRegistryEntry[] | null): GameExposure {
  if (!isGameId(id)) return UNKNOWN;
  return resolveGameExposure(id, { index, hostProtocol: GAME_PROTOCOL });
}

/**
 * WHY: exactly the ids a tap opens (`resolveGamePage`); until the registry answers with nothing cached, no game
 * shows, since the app bundles no page.
 */
export function useOpenableGameIds(): readonly GameId[] {
  const { data } = useQuery(gameIndexQueryOptions());
  return useMemo(
    () => toOpenableGameIds(GAME_IDS, { index: data ?? null, hostProtocol: GAME_PROTOCOL, origins: getGameOrigins() }),
    [data],
  );
}

/**
 * WHY: frozen when the screen opens: the opener already awaited the registry, so this copy is the one it
 * decided by, and a registry change mid-run never swaps or closes the page under the player.
 */
export function useGameExposure(id: string | undefined): GameExposure {
  const { data } = useQuery(gameIndexQueryOptions());
  const [atOpen] = useState(() => (id ? exposureOf(id, data ?? null) : UNKNOWN));
  return atOpen;
}

export function useGamePage(id: string | undefined): GamePage | null {
  const exposure = useGameExposure(id);
  const [atOpen] = useState(() => (id ? toGamePage(id, exposure, getGameOrigins()) : null));
  return atOpen;
}
