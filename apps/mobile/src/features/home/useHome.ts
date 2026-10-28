import { useCallback, useMemo } from 'react';
import { useT } from '@skkuverse/shared';
import type { TossfaceGridItem } from '@/components/TossfaceButtonGrid';
import { useOpenableGameIds } from '@/features/games/useGameExposure';
import { usePromotedTiles, type PromotedTile } from '@/features/promo/usePromotedTiles';
import { useMiniAppIndex } from '@/features/web/useMiniAppIndex';
import { handleSduiAction, openMiniAppById } from '@/features/web/web.service';
import { logHomeContentSelect } from '@/platform/analytics';
import { mockHomeLayout } from './home.constants';
import { toHomeSections } from './home.rules';
import type { HomeScreenSection, HomeScreenTile, HomeScreenTileTarget } from './home.types';

export type HomeScreenPressableSection =
  | Exclude<HomeScreenSection, { kind: 'grid' }>
  | { kind: 'grid'; key: string; title?: string; tiles: TossfaceGridItem[] };

function openTileTarget(id: string, target: HomeScreenTileTarget): void {
  logHomeContentSelect({ content_type: 'tile', item_id: id });
  // WHY: a game and a mini app open alike, so their view_open sources compare.
  if (target.kind === 'game' || target.kind === 'miniapp') openMiniAppById(target.id, undefined, 'home_tile');
  else {
    handleSduiAction({
      ...target.action,
      // WHY: every page on our webview host shares one <title>, so the tile's label heads it.
      webviewTitle: target.action.actionType === 'webview' ? target.title : undefined,
      source: 'home_tile',
    });
  }
}

function withTilePress({ target, ...tile }: HomeScreenTile, promoted: PromotedTile | null): TossfaceGridItem {
  if (!promoted) return { ...tile, onPress: () => openTileTarget(tile.id, target) };
  // WHY: a promoted game logs its tile tap as ever, then its promo tap, and opens with the slot's source.
  return {
    ...tile,
    viewRef: promoted.viewRef,
    onPress: () => {
      logHomeContentSelect({ content_type: 'tile', item_id: tile.id });
      promoted.onPress();
    },
  };
}

export function useHome(): { sections: HomeScreenPressableSection[] } {
  const { t } = useT();
  const { data: miniApps } = useMiniAppIndex();
  // WHY: a game the registry hides, or this build cannot open, has no tile and no hall line.
  const gameIds = useOpenableGameIds();
  const { tileOf } = usePromotedTiles(gameIds);
  const promotedOf = useCallback(
    ({ target }: HomeScreenTile) => (target.kind === 'game' ? tileOf(target.id) : null),
    [tileOf],
  );

  const sections = useMemo(() => {
    const layout = mockHomeLayout(t);
    return toHomeSections(layout, { miniApps: miniApps ?? [], gameIds, t }).map(
      (section): HomeScreenPressableSection =>
        section.kind === 'grid' ? { ...section, tiles: section.tiles.map((tile) => withTilePress(tile, promotedOf(tile))) } : section,
    );
  }, [miniApps, gameIds, t, promotedOf]);

  return { sections };
}
