/**
 * Home's layout as the screen draws it (spec home/home-layout): a tile renders
 * only when this build can open it, a grid with none left is dropped, every
 * openable game is reachable, and one hall of fame follows the first grid that
 * holds a game.
 */
import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '@skkuverse/shared';
import type { GameId } from '@/features/games/games.constants';
import type { MiniAppIndexEntry } from '@/features/web/web.types';
import { mockHomeLayout } from './home.constants';
import { HALL_OF_FAME_KEY, UNPLACED_GAMES_KEY, homeBottomRoom, toHomeSections, toScreenTile } from './home.rules';
import { homeLayoutSchema } from './home.schema';
import type { HomeLayout, HomeLayoutSection, HomeLayoutTile, HomeScreenSection, HomeScreenTile } from './home.types';
import ko from './__fixtures__/home-layout.production-ko.json';

const GAMES: GameId[] = ['wave-run', 'subway-typing'];
const t = (key: TranslationKey) => `t:${key}`;
const app = (id: string, extra: Partial<MiniAppIndexEntry> = {}) =>
  ({ id, name: `${id} name`, homeLogo: null, ...extra }) as MiniAppIndexEntry;
const inputs = (miniApps: MiniAppIndexEntry[] = []) => ({ miniApps, gameIds: GAMES, t });
const grid = (id: string, tiles: HomeLayoutTile[], title?: string): HomeLayoutSection => ({ type: 'tile_grid', id, title, tiles });
const game = (id: string): HomeLayoutTile => ({ kind: 'game', id });

/** Each section's kind and key, with a grid's tile ids and the hall's games. */
function summary(sections: HomeScreenSection[]) {
  return sections.map((s) =>
    s.kind === 'grid'
      ? { kind: s.kind, key: s.key, tiles: s.tiles.map((tile) => tile.id) }
      : s.kind === 'hall'
        ? { kind: s.kind, games: s.gameIds }
        : { kind: s.kind, key: s.key },
  );
}

describe('toScreenTile', () => {
  const apps = new Map([['known', app('known', { shortName: 'Short' })]]);
  const link: HomeLayoutTile = {
    kind: 'link',
    id: 'l',
    title: 'Search',
    icon: { kind: 'remote', uri: 'https://x/l.png' },
    action: { actionType: 'route', actionValue: '/search' },
  };

  it.each<{ name: string; tile: HomeLayoutTile; expected: HomeScreenTile | null }>([
    {
      name: 'a game this build can open',
      tile: game('wave-run'),
      expected: { id: 'wave-run', title: 't:game.waveRun.title', emoji: '\u{1F3C4}', target: { kind: 'game', id: 'wave-run' } },
    },
    { name: 'a game this build does not ship', tile: game('chess'), expected: null },
    {
      name: 'a mini app in the index, by its short name',
      tile: { kind: 'miniapp', id: 'known' },
      expected: { id: 'known', title: 'Short', emoji: '\u{1F9E9}', target: { kind: 'miniapp', id: 'known' } },
    },
    { name: 'a mini app the index does not list', tile: { kind: 'miniapp', id: 'gone' }, expected: null },
    {
      name: 'a link, with its own remote icon',
      tile: link,
      expected: {
        id: 'l',
        title: 'Search',
        imageSource: { uri: 'https://x/l.png' },
        target: { kind: 'link', title: 'Search', action: { actionType: 'route', actionValue: '/search' } },
      },
    },
  ])('$name', ({ tile, expected }) => {
    // Act
    const view = toScreenTile(tile, apps, { gameIds: GAMES, t });

    // Assert
    expect(view).toEqual(expected);
  });

  it('names a mini app by its name when it has no short name, and draws its emoji logo', () => {
    // Arrange
    const apps = new Map([['m', app('m', { homeLogo: { kind: 'emoji', emoji: '\u{1F4DA}' } })]]);

    // Act
    const view = toScreenTile({ kind: 'miniapp', id: 'm' }, apps, { gameIds: GAMES, t });

    // Assert
    expect(view).toMatchObject({ title: 'm name', emoji: '\u{1F4DA}' });
  });
});

describe('toHomeSections', () => {
  it('places every production tile, with the hall of fame after the game grid', () => {
    // Act
    const sections = toHomeSections(homeLayoutSchema.parse(ko.data), inputs());

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'banner', key: 'home_top' },
      {
        kind: 'grid',
        key: 'home_tiles',
        tiles: ['building_map', 'building_code', 'lost_found', 'inquiry', 'subway-typing', 'wave-run'],
      },
      { kind: 'hall', games: ['subway-typing', 'wave-run'] },
    ]);
  });

  it('draws the mock layout as titled mini-app and game grids, the hall of fame under the games', () => {
    // Arrange
    const miniApps = ['hssc', 'nsc', 'skkuw', 'skkuzine'].map((id) => app(id));

    // Act
    const sections = toHomeSections(mockHomeLayout(t), inputs(miniApps));

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'banner', key: 'home_top' },
      {
        kind: 'grid',
        key: 'mini_apps',
        tiles: ['meals', 'building_map', 'building_code'],
      },
      { kind: 'grid', key: 'games', tiles: ['subway-typing', 'wave-run'] },
      { kind: 'hall', games: ['subway-typing', 'wave-run'] },
    ]);
    expect(sections.filter((s) => s.kind === 'grid').map((s) => s.kind === 'grid' && s.title)).toEqual([
      't:home.section.miniApps',
      't:home.section.miniGames',
    ]);
  });

  it('drops an unknown mini app, an unshipped game and a grid left empty', () => {
    // Arrange
    const layout: HomeLayout = {
      version: 1,
      sections: [grid('apps', [{ kind: 'miniapp', id: 'known' }, { kind: 'miniapp', id: 'gone' }]), grid('empty', [game('chess')])],
    };

    // Act
    const sections = toHomeSections(layout, inputs([app('known')]));

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'grid', key: 'apps', tiles: ['known'] },
      { kind: 'grid', key: UNPLACED_GAMES_KEY, tiles: ['wave-run', 'subway-typing'] },
      { kind: 'hall', games: ['wave-run', 'subway-typing'] },
    ]);
  });

  it('keeps a grid title and passes a feed section through', () => {
    // Arrange
    const feed = { type: 'miniapp_feed' as const, id: 'f', miniAppId: 'eskara', limit: 3 };
    const layout: HomeLayout = { version: 1, sections: [feed, grid('g', [game('wave-run'), game('subway-typing')], 'Games')] };

    // Act
    const sections = toHomeSections(layout, inputs());

    // Assert
    expect(sections[0]).toEqual({ kind: 'feed', key: 'f', feed });
    expect(sections[1]).toMatchObject({ kind: 'grid', key: 'g', title: 'Games' });
  });

  it('puts the hall of fame after the first grid holding a game, with every game in tile order', () => {
    // Arrange
    const layout: HomeLayout = {
      version: 1,
      sections: [
        grid('apps', [{ kind: 'miniapp', id: 'known' }]),
        grid('home_tiles', [game('subway-typing'), game('wave-run')]),
        grid('more', [game('wave-run')]),
      ],
    };

    // Act
    const sections = toHomeSections(layout, inputs([app('known')]));

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'grid', key: 'apps', tiles: ['known'] },
      { kind: 'grid', key: 'home_tiles', tiles: ['subway-typing', 'wave-run'] },
      { kind: 'hall', games: ['subway-typing', 'wave-run'] },
      { kind: 'grid', key: 'more', tiles: ['wave-run'] },
    ]);
  });

  it('gives the games no grid places a titled grid, followed by the hall of fame', () => {
    // Act
    const sections = toHomeSections({ version: 1, sections: [grid('apps', [{ kind: 'miniapp', id: 'known' }])] }, inputs([app('known')]));

    // Assert
    expect(sections.slice(1)).toEqual([
      expect.objectContaining({ kind: 'grid', key: UNPLACED_GAMES_KEY, title: 't:home.section.miniGames' }),
      { kind: 'hall', key: HALL_OF_FAME_KEY, gameIds: ['wave-run', 'subway-typing'] },
    ]);
  });

  it('lists an unplaced game in the hall after the placed ones, and gives it its own grid', () => {
    // Act
    const sections = toHomeSections({ version: 1, sections: [grid('g', [game('subway-typing')])] }, inputs());

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'grid', key: 'g', tiles: ['subway-typing'] },
      { kind: 'hall', games: ['subway-typing', 'wave-run'] },
      { kind: 'grid', key: UNPLACED_GAMES_KEY, tiles: ['wave-run'] },
    ]);
  });

  it('drops every trace of a game the registry hides: its placed tile, its own grid and its hall line', () => {
    // Arrange: wave-run is hidden, so it is not among the games home may open.
    const layout: HomeLayout = { version: 1, sections: [grid('g', [game('wave-run'), game('subway-typing')])] };

    // Act
    const sections = toHomeSections(layout, { miniApps: [], gameIds: ['subway-typing'], t });

    // Assert
    expect(summary(sections)).toEqual([
      { kind: 'grid', key: 'g', tiles: ['subway-typing'] },
      { kind: 'hall', games: ['subway-typing'] },
    ]);
  });
});

// The bottom of home's scroll clears the tab bar once: the shell's inset where
// one is provided, else the platform's own.
describe('homeBottomRoom', () => {
  const BASE = 32;
  const SPACER = 80;

  it.each([
    ['iOS 26 under the native tabs', { automaticInsets: true, tabBarInset: 0, safeBottom: 34 }, { paddingBottom: BASE, spacer: 0 }],
    ['iOS before 26 or Android under the native tabs', { automaticInsets: false, tabBarInset: 0, safeBottom: 34 }, { paddingBottom: BASE, spacer: SPACER }],
    ['iOS 26 under the shared map', { automaticInsets: true, tabBarInset: 117, safeBottom: 34 }, { paddingBottom: BASE + 83, spacer: 0 }],
    ['iOS before 26 under the shared map', { automaticInsets: false, tabBarInset: 104, safeBottom: 34 }, { paddingBottom: BASE + 104, spacer: 0 }],
    ['Android under the shared map', { automaticInsets: false, tabBarInset: 83, safeBottom: 0 }, { paddingBottom: BASE + 83, spacer: 0 }],
  ])('clears the tab bar once on %s', (_label, inputs, expected) => {
    // Act
    const room = homeBottomRoom(inputs);

    // Assert
    expect(room).toEqual(expected);
  });
});
