import type { ActionType, BannerCarousel, Logo } from '@skkuverse/shared';
import type { GameId } from '@/features/games/games.constants';

export type HomeLayoutTile =
  | { kind: 'miniapp'; id: string }
  | { kind: 'game'; id: string }
  | {
      kind: 'link';
      id: string;
      title: string;
      icon: Logo;
      action: { actionType: ActionType; actionValue: string };
    };

export type HomeLayoutLinkTile = Extract<HomeLayoutTile, { kind: 'link' }>;

export interface HomeLayoutTileGrid {
  type: 'tile_grid';
  id: string;
  title?: string;
  tiles: HomeLayoutTile[];
}

export interface HomeLayoutMiniAppFeed {
  type: 'miniapp_feed';
  id: string;
  miniAppId: string;
  title?: string;
  limit: number;
}

export type HomeLayoutSection = BannerCarousel | HomeLayoutTileGrid | HomeLayoutMiniAppFeed;

export interface HomeLayout {
  version: number;
  sections: HomeLayoutSection[];
}

export type HomeScreenTileTarget =
  | { kind: 'miniapp'; id: string }
  | { kind: 'game'; id: GameId }
  | { kind: 'link'; title: string; action: HomeLayoutLinkTile['action'] };

export interface HomeScreenTile {
  id: string;
  title: string;
  emoji?: string;
  imageSource?: { uri: string };
  target: HomeScreenTileTarget;
}

export type HomeScreenSection =
  | { kind: 'banner'; key: string; carousel: BannerCarousel }
  | { kind: 'feed'; key: string; feed: HomeLayoutMiniAppFeed }
  | { kind: 'grid'; key: string; title?: string; tiles: HomeScreenTile[] }
  | { kind: 'hall'; key: string; gameIds: GameId[] };
