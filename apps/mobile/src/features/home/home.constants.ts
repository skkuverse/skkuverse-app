// WHY: no endpoint serves the mini-apps tab's layout, and GET /ui/home serves older builds' home, so it is held here,
// in a shape that endpoint could serve as it stands (home.constants.test.ts round-trips it through the parser).
import type { TranslationKey } from '@skkuverse/shared';
import type { HomeLayout } from './home.types';

export const HOME_LAYOUT_VERSION = 1;
export const DEFAULT_MINIAPP_FEED_LIMIT = 3;
export const MINIAPP_FEED_LIMIT_MAX = 10;

export function mockHomeLayout(t: (key: TranslationKey) => string): HomeLayout {
  return {
    version: HOME_LAYOUT_VERSION,
    sections: [
      {
        type: 'banner_carousel',
        id: 'home_top',
        aspectRatio: 3,
        autoRotateSec: 5,
        items: [{ type: 'default' }],
      },
      {
        type: 'tile_grid',
        id: 'mini_apps',
        title: t('home.section.miniApps'),
        tiles: [
          {
            kind: 'link',
            id: 'meals',
            title: t('meals.title'),
            icon: { kind: 'emoji', emoji: '\u{1F35A}' },
            action: { actionType: 'route', actionValue: '/meals' },
          },
          // WHY: same ids and actions as the campus sheet's service buttons, so a tap means the same on both.
          {
            kind: 'link',
            id: 'building_map',
            title: t('home.tile.buildingMap'),
            icon: { kind: 'emoji', emoji: '\u{1F3E2}' },
            action: { actionType: 'route', actionValue: '/map/hssc' },
          },
          {
            kind: 'link',
            id: 'building_code',
            title: t('home.tile.buildingCode'),
            icon: { kind: 'emoji', emoji: '\u{1F522}' },
            action: { actionType: 'route', actionValue: '/search' },
          },
          // WHY: the registry hides it from the old auto grid; naming it here draws it.
          { kind: 'miniapp', id: 'booth-box' },
        ],
      },
      {
        type: 'tile_grid',
        id: 'games',
        title: t('home.section.miniGames'),
        tiles: [
          { kind: 'game', id: 'subway-typing' },
          { kind: 'game', id: 'wave-run' },
          { kind: 'game', id: 'suika-game' },
          { kind: 'game', id: 'apple-game' },
          { kind: 'game', id: 'building-stack' },
          { kind: 'game', id: 'bigger-building' },
        ],
      },
    ],
  };
}
