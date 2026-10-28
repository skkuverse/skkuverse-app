import { SdsSpacing, type Logo, type TranslationKey } from '@skkuverse/shared';
import { gameTileOf, type GameId } from '@/features/games/games.constants';
import type { MiniAppIndexEntry } from '@/features/web/web.types';
import type { HomeLayout, HomeLayoutSection, HomeLayoutTile, HomeScreenSection, HomeScreenTile } from './home.types';

export interface ToHomeSectionsInputs {
  miniApps: readonly MiniAppIndexEntry[];
  // WHY: only the games openable now, in first-party order (`useOpenableGameIds`); a placed tile for any other is dropped.
  gameIds: readonly GameId[];
  t: (key: TranslationKey) => string;
}

export const UNPLACED_GAMES_KEY = 'unplaced-games';
export const HALL_OF_FAME_KEY = 'hall-of-fame';

/** QUIRK(skkuverse-server): a logo this build cannot draw arrives as null and shows 🧩. */
function tileIcon(icon: Logo | null): Pick<HomeScreenTile, 'emoji' | 'imageSource'> {
  return icon?.kind === 'remote'
    ? { imageSource: { uri: icon.uri } }
    : { emoji: icon?.kind === 'emoji' ? icon.emoji : '\u{1F9E9}' };
}

function gameTile(id: GameId, t: ToHomeSectionsInputs['t']): HomeScreenTile {
  const { titleKey, homeEmoji } = gameTileOf(id);
  return { id, title: t(titleKey), emoji: homeEmoji, target: { kind: 'game', id } };
}

export function toScreenTile(
  tile: HomeLayoutTile,
  apps: ReadonlyMap<string, MiniAppIndexEntry>,
  { gameIds, t }: Pick<ToHomeSectionsInputs, 'gameIds' | 't'>,
): HomeScreenTile | null {
  if (tile.kind === 'game') {
    const id = gameIds.find((game) => game === tile.id);
    return id ? gameTile(id, t) : null;
  }
  if (tile.kind === 'miniapp') {
    const app = apps.get(tile.id);
    if (!app) return null;
    return { id: app.id, title: app.shortName ?? app.name, ...tileIcon(app.homeLogo), target: { kind: 'miniapp', id: app.id } };
  }
  return { id: tile.id, title: tile.title, ...tileIcon(tile.icon), target: { kind: 'link', title: tile.title, action: tile.action } };
}

function toScreenSection(
  section: HomeLayoutSection,
  apps: ReadonlyMap<string, MiniAppIndexEntry>,
  inputs: ToHomeSectionsInputs,
): HomeScreenSection | null {
  switch (section.type) {
    case 'banner_carousel':
      return { kind: 'banner', key: section.id, carousel: section };
    case 'miniapp_feed':
      return { kind: 'feed', key: section.id, feed: section };
    case 'tile_grid': {
      const tiles = section.tiles.flatMap((tile) => toScreenTile(tile, apps, inputs) ?? []);
      return tiles.length > 0 ? { kind: 'grid', key: section.id, title: section.title, tiles } : null;
    }
  }
}

function toGameIds(section: HomeScreenSection): GameId[] {
  if (section.kind !== 'grid') return [];
  return section.tiles.flatMap(({ target }) => (target.kind === 'game' ? [target.id] : []));
}

function hasGame(section: HomeScreenSection): boolean {
  return toGameIds(section).length > 0;
}

function unplacedGamesGrid(gameIds: GameId[], t: ToHomeSectionsInputs['t']): HomeScreenSection {
  return { kind: 'grid', key: UNPLACED_GAMES_KEY, title: t('home.section.miniGames'), tiles: gameIds.map((id) => gameTile(id, t)) };
}

function withHallOfFame(sections: HomeScreenSection[], hall: HomeScreenSection): HomeScreenSection[] {
  const firstGameGrid = sections.findIndex(hasGame);
  const at = firstGameGrid === -1 ? sections.length : firstGameGrid + 1;
  return [...sections.slice(0, at), hall, ...sections.slice(at)];
}

// WHY: a game no grid places gets a grid of its own, so every openable game stays reachable.
export function toHomeSections(layout: HomeLayout, inputs: ToHomeSectionsInputs): HomeScreenSection[] {
  const apps = new Map(inputs.miniApps.map((app) => [app.id, app]));
  const laidOut = layout.sections.flatMap((section) => toScreenSection(section, apps, inputs) ?? []);
  const placed = laidOut.flatMap(toGameIds);
  const unplaced = inputs.gameIds.filter((id) => !placed.includes(id));
  const sections = unplaced.length > 0 ? [...laidOut, unplacedGamesGrid(unplaced, inputs.t)] : laidOut;
  const gameIds = [...new Set([...placed, ...unplaced])];
  return withHallOfFame(sections, { kind: 'hall', key: HALL_OF_FAME_KEY, gameIds });
}

export interface HomeBottomInputs {
  automaticInsets: boolean;
  tabBarInset: number;
  safeBottom: number;
}

// WHY: a docked JS tab bar reports no inset, so its clearance is a fixed spacer.
const DOCKED_TAB_BAR_SPACER = 80;

// WHY: a shell that reports its bar is the one answer (less the home indicator the automatic inset
// clears); the platform spacer applies only without one, never both.
export function homeBottomRoom({ automaticInsets, tabBarInset, safeBottom }: HomeBottomInputs): {
  paddingBottom: number;
  spacer: number;
} {
  if (tabBarInset > 0) {
    const extra = Math.max(0, tabBarInset - (automaticInsets ? safeBottom : 0));
    return { paddingBottom: SdsSpacing.x8 + extra, spacer: 0 };
  }
  return { paddingBottom: SdsSpacing.x8, spacer: automaticInsets ? 0 : DOCKED_TAB_BAR_SPACER };
}
