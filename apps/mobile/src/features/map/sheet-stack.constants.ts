/** WHY: a new kind picks a profile instead of a layout of its own (ADR 0022 d3). */

import type { SheetDetent } from '@skkuverse/sds';
import { LEVEL_SURFACE, type MapDetent } from './sheet-detents.constants';

export type MapSheetProfileName = 'campusRoot' | 'thisWeekRoot' | 'transitRoot' | 'place' | 'peek' | 'list' | 'stop' | 'route';

export type TaskOverlayRole = 'stop' | 'directionLabel' | 'focusedPlace';
export const TASK_OVERLAY_ROLES: readonly TaskOverlayRole[] = ['stop', 'directionLabel', 'focusedPlace'];

/**
 * WHY: views publish every overlay tagged by role and the host keeps what the lens names, so a view never
 * reasons about levels.
 */
export type MapLensName = 'everything' | 'routeOnly' | 'routeWithStops' | 'routeWithStopsAndLabels' | 'focusedStop';
export const MAP_LENS_ROLES: Readonly<Record<MapLensName, ReadonlySet<TaskOverlayRole>>> = {
  everything: new Set(TASK_OVERLAY_ROLES),
  routeOnly: new Set(),
  routeWithStops: new Set(['stop']),
  routeWithStopsAndLabels: new Set(['stop', 'directionLabel']),
  focusedStop: new Set(TASK_OVERLAY_ROLES),
};

/** WHY: the first row always says what the map is showing (ADR 0022 d1); the one close mark is the sheet's. */
export type TopChromeName = 'world' | 'taskField' | 'none';

export type SheetBodyVariant = 'full' | 'headerOnly';


/** WHY: a `keep` level (a page) moves nothing; the view re-fits as a jump when the settled level changes. */
export type DetentFraming = { kind: 'keep' } | { kind: 'fit'; margin: { top: number; bottom: number } };

export const KEEP: DetentFraming = { kind: 'keep' };

export interface LevelPresentation {
  lens: MapLensName;
  body: SheetBodyVariant;
  framing: DetentFraming;
  surface: 'glass' | 'solid';
}

/** QUIRK(gorhom-bottom-sheet): it lets the list scroll only at the top level (`SHEET_STATE.EXTENDED`). */
export interface DetentPresentation extends LevelPresentation {
  chrome: TopChromeName;
  listScrolls: boolean;
}

export const ROOT_PRESENTATION: DetentPresentation = {
  lens: 'everything',
  chrome: 'world',
  body: 'full',
  framing: KEEP,
  surface: 'glass',
  listScrolls: false,
};

export interface MapSheetProfile {
  chrome: 'world' | 'taskField';
  levels: readonly [MapDetent, MapDetent, ...MapDetent[]];
  opening: MapDetent;
  /** WHY: total over all four, so a read never falls back; an unused level's entry is dead data. */
  at: Readonly<Record<MapDetent, LevelPresentation>>;
}

const SDS_DETENTS = ['small', 'medium', 'large'] as const satisfies readonly SheetDetent[];

export function sdsDetentsOf(levels: readonly MapDetent[]): [SheetDetent, SheetDetent, ...SheetDetent[]] {
  const [first, second, ...rest] = SDS_DETENTS.slice(0, levels.length);
  return [first, second, ...rest];
}

function throughout(presentation: Omit<LevelPresentation, 'surface'>): Readonly<Record<MapDetent, LevelPresentation>> {
  const at = (level: MapDetent): LevelPresentation => ({ ...presentation, surface: LEVEL_SURFACE[level] });
  return { min: at('min'), mid: at('mid'), max: at('max'), page: at('page') };
}

const WORLD = throughout({ lens: 'everything', body: 'full', framing: KEEP });

/** WHY: `satisfies`, not an annotation, so each profile's literal levels stay visible. */
export const MAP_SHEET_PROFILES = {
  campusRoot: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'min', at: WORLD },
  thisWeekRoot: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'mid', at: WORLD },
  /**
   * WHY: opens expanded just under the top controls, since a locate in the map tab can switch the shared
   * selection silently and this is where the user sees it.
   */
  transitRoot: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'max', at: WORLD },
  place: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'max', at: WORLD },
  peek: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'min', at: WORLD },
  list: { chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'mid', at: WORLD },
  /** WHY: part-way over the map, so the route it was opened from stays in view (ADR 0022 d3). */
  stop: {
    chrome: 'taskField',
    levels: ['min', 'mid', 'max'],
    opening: 'mid',
    at: throughout({ lens: 'focusedStop', body: 'full', framing: KEEP }),
  },
  /**
   * WHY: what the map shows follows its zoom, not the level; the task field stays across the lower levels, so the
   * host's top padding never moves on a drag.
   */
  route: {
    chrome: 'taskField',
    levels: ['min', 'mid', 'page'],
    opening: 'mid',
    at: {
      // EVIDENCE: 48 above and 24 below at `min` fit a direction label over the northernmost stop and a name under the
      // southernmost; 12 at `mid` is NAVER's 8 plus the route's outline (its line screens, 2026-10-24).
      min: {
        lens: 'routeWithStopsAndLabels',
        body: 'headerOnly',
        framing: { kind: 'fit', margin: { top: 48, bottom: 24 } },
        surface: LEVEL_SURFACE.min,
      },
      mid: {
        lens: 'routeWithStops',
        body: 'full',
        framing: { kind: 'fit', margin: { top: 12, bottom: 12 } },
        surface: LEVEL_SURFACE.mid,
      },
      max: { lens: 'routeWithStops', body: 'full', framing: KEEP, surface: LEVEL_SURFACE.max },
      page: { lens: 'routeOnly', body: 'full', framing: KEEP, surface: LEVEL_SURFACE.page },
    },
  },
} satisfies Readonly<Record<MapSheetProfileName, MapSheetProfile>>;

export type MapRootProfileName = 'campusRoot' | 'thisWeekRoot' | 'transitRoot';
