import type { TranslationKey } from '@skkuverse/shared';
import type { GameId } from '@/features/games/games.constants';
import type { EntrySource } from '@/platform/analytics.rules';

export type PromoSlot = 'transit_top' | 'miniapp_games';

export interface PromoEntry {
  id: string;
  target: GameId;
}

export interface PromoCreative {
  /**
   * WHY: a string, not a union, because the list moves to a server config and
   * old builds must read ids they never shipped.
   */
  id: string;
  emoji: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  weight: number;
  target: GameId;
}

/** WHY: a type alias, since `track` takes a record and only an alias is assignable to one. */
export type PromoParams = {
  slot: PromoSlot;
  creative_id: string;
  target: GameId;
};

export interface PromoLink {
  id: GameId;
  via: EntrySource;
}

export interface PromoBand {
  top: number;
  bottom: number;
}
