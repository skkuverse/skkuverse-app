import { createRef, useCallback, useMemo, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useTabBarInset } from '@/components/useTabBarInset';
import type { GameId } from '@/features/games/games.constants';
import { PROMOTED_PAGE_GAMES } from './promo.constants';
import { toPromoParams } from './promo.rules';
import { openPromoTile } from './promo.service';
import { usePromoImpressions } from './usePromoImpressions';

const SLOT = 'miniapp_games';

export interface PromotedTile {
  viewRef: RefObject<View | null>;
  onPress: () => void;
}

export function usePromotedTiles(gameIds: readonly GameId[]) {
  const headerHeight = useHeaderHeight();
  const tabBarInset = useTabBarInset();
  const safeBottom = useSafeAreaInsets().bottom;
  // WHY: one ref per promoted game for the screen's life, so a tile keeps its ref across renders.
  const [refs] = useState(() => new Map(PROMOTED_PAGE_GAMES.map((id) => [id, createRef<View>()])));

  const shown = useMemo(() => PROMOTED_PAGE_GAMES.filter((id) => gameIds.includes(id)), [gameIds]);
  const entries = useMemo(
    () => shown.flatMap((id) => {
      const ref = refs.get(id);
      return ref ? [{ params: toPromoParams(SLOT, { id, target: id }), ref }] : [];
    }),
    [shown, refs],
  );
  // WHY: the native tab bar provides no inset, so the home indicator's band stands in for it.
  usePromoImpressions(entries, { top: headerHeight, bottomInset: Math.max(tabBarInset, safeBottom) });

  const tileOf = useCallback(
    (id: GameId): PromotedTile | null => {
      const viewRef = refs.get(id);
      if (!viewRef || !shown.includes(id)) return null;
      return { viewRef, onPress: () => openPromoTile(SLOT, id) };
    },
    [refs, shown],
  );

  return { tileOf };
}
