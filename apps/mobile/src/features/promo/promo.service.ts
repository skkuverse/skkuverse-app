import { router } from 'expo-router';
import type { GameId } from '@/features/games/games.constants';
import { openMiniAppById, pendingMiniAppLink } from '@/features/web/web.service';
import { markTabSwitch, track } from '@/platform/analytics';
import { toPromoEntrySource, toPromoLink, toPromoParams } from './promo.rules';
import type { PromoCreative, PromoSlot } from './promo.types';

/**
 * WHY: one push after the tab switch, drained by the root layout's pending-link
 * consumer, never two that race; back from the game lands on the mini-app tab.
 */
export function openPromoCreative(slot: PromoSlot, creative: PromoCreative): void {
  track('promo_tap', toPromoParams(slot, creative));
  markTabSwitch('home', 'promo');
  router.navigate('/(tabs)/home');
  pendingMiniAppLink.set(toPromoLink(slot, creative));
}

export function openPromoTile(slot: PromoSlot, gameId: GameId): void {
  track('promo_tap', toPromoParams(slot, { id: gameId, target: gameId }));
  openMiniAppById(gameId, undefined, toPromoEntrySource(slot));
}
