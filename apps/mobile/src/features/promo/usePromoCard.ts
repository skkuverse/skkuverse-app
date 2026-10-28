import { useCallback, useMemo, useState } from 'react';
import { useSettingsStore, useT } from '@skkuverse/shared';
import { REVIVING_GAME_IDS } from '@/features/games/games.constants';
import { useOpenableGameIds } from '@/features/games/useGameExposure';
import { PROMO_CREATIVES } from './promo.constants';
import { decidePromoCreative, isPromoLanguage, toPromoParams } from './promo.rules';
import { openPromoCreative } from './promo.service';
import type { PromoParams, PromoSlot } from './promo.types';

// WHY: one roll per app session, so every card mount this session shows the same creative.
const SESSION_ROLL = Math.random();

export interface PromoCardView {
  emoji: string;
  caption: string;
  title: string;
  subtitle: string;
}

export function usePromoCard(slot: PromoSlot) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const openable = useOpenableGameIds();
  // WHY: decided once per mount, so a registry answering late never slides the rows under a finger.
  const [creative] = useState(() =>
    decidePromoCreative(PROMO_CREATIVES, { openable, reviving: REVIVING_GAME_IDS, roll: SESSION_ROLL }),
  );
  const shown = creative && isPromoLanguage(lang) ? creative : null;

  const params = useMemo<PromoParams | null>(() => shown && toPromoParams(slot, shown), [shown, slot]);

  const card = useMemo<PromoCardView | null>(
    () =>
      shown && {
        emoji: shown.emoji,
        caption: t('promo.caption'),
        title: t(shown.titleKey),
        subtitle: t(shown.subtitleKey),
      },
    [shown, t],
  );

  const onPress = useCallback(() => {
    if (shown) openPromoCreative(slot, shown);
  }, [shown, slot]);

  return { card, params, onPress };
}
