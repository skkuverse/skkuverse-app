import type { GameId } from '@/features/games/games.constants';
import type { PromoCreative } from './promo.types';

/**
 * EVIDENCE: the AdMob review found `game_revive` the only inventory with a yield,
 * and only wave-run and suika-game revive; `decidePromoCreative` drops any other target.
 */
export const PROMO_CREATIVES: readonly PromoCreative[] = [
  {
    id: 'wave-run',
    emoji: '\u{1F3C4}',
    titleKey: 'promo.waveRun.title',
    subtitleKey: 'promo.waveRun.subtitle',
    weight: 80,
    target: 'wave-run',
  },
  {
    id: 'suika-game',
    emoji: '\u{1F349}',
    titleKey: 'promo.suikaGame.title',
    subtitleKey: 'promo.suikaGame.subtitle',
    weight: 20,
    target: 'suika-game',
  },
];

export const PROMOTED_PAGE_GAMES: readonly GameId[] = ['building-stack', 'bigger-building'];
