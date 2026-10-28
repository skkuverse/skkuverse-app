import type { TranslationKey } from '@skkuverse/shared';
import { FIRST_PARTY_GAMES, type GameId } from './registry.rules';

/**
 * WHY: a game shares the mini-app id namespace, so `/m/<id>` and a mini-app tile reach the game screen.
 * There is no web mini-app fallback: an id this build does not know, or one the registry does not open,
 * opens nothing.
 */
export type { GameId };

export const GAME_IDS = Object.keys(FIRST_PARTY_GAMES) as readonly GameId[];

export function isGameId(id: string): id is GameId {
  return (GAME_IDS as readonly string[]).includes(id);
}

export const REVIVING_GAME_IDS: readonly GameId[] = GAME_IDS.filter((id) => FIRST_PARTY_GAMES[id].revives);

export interface GameTile {
  titleKey: TranslationKey;
  homeEmoji: string;
}

export function gameTileOf(id: GameId): GameTile {
  const { titleKey, homeEmoji } = FIRST_PARTY_GAMES[id];
  return { titleKey, homeEmoji };
}
