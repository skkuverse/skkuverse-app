import type { TranslationKey } from '@skkuverse/shared';
import type { SheetDetent, SheetPosition } from '@skkuverse/sds';
import type { MapSheetEntry, MapSheetKind, MapSheetRequest, MapTaskState } from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';
import type { MapDetent } from './sheet-detents.constants';
import {
  MAP_SHEET_PROFILES,
  ROOT_PRESENTATION,
  sdsDetentsOf,
  type DetentPresentation,
  type MapSheetProfile,
  type MapSheetProfileName,
} from './sheet-stack.constants';

export interface SheetStackLayout {
  bodies: readonly MapSheetEntry[];
  /** WHY: a `select` keeps one card of a kind. */
  cards: readonly MapSheetEntry[];
}

export function toSheetStackLayout(task: MapTaskState, views: Partial<MapSheetViewTable>): SheetStackLayout {
  const bodies: MapSheetEntry[] = [];
  const cardByKind = new Map<MapSheetKind, MapSheetEntry>();
  for (const entry of task.stack) {
    const def = views[entry.request.kind];
    if (!def) continue;
    if (def.presentation === 'swap') bodies.push(entry);
    else cardByKind.set(entry.request.kind, entry);
  }
  return { bodies, cards: [...cardByKind.values()] };
}

/** WHY: structural, since a kind's `View` is not assignable to the union's and the profile never depends on it. */
type SheetPresentation =
  | { presentation: 'swap'; profile: MapSheetProfileName; openingOf?(request: MapSheetRequest): MapDetent }
  | { presentation: 'over' };

export function profileOf(def: SheetPresentation | undefined): MapSheetProfile | null {
  return def?.presentation === 'swap' ? MAP_SHEET_PROFILES[def.profile] : null;
}

export function initialDetentOf(def: SheetPresentation | undefined, request: MapSheetRequest): MapDetent {
  if (def?.presentation !== 'swap') return 'min';
  return def.openingOf?.(request) ?? MAP_SHEET_PROFILES[def.profile].opening;
}

/** WHY: a `keep` level moves no padding, and a return to a fitting level re-fits into its band. */
export function framingDetentOf(profile: MapSheetProfile | null, settled: MapDetent | null): MapDetent | null {
  if (!profile) return null;
  const detent = settled ?? profile.opening;
  return profile.at[detent].framing.kind === 'fit' ? detent : profile.opening;
}

export function topProfile(layout: SheetStackLayout, views: Partial<MapSheetViewTable>): MapSheetProfile | null {
  const top = layout.bodies.at(-1);
  return profileOf(top ? views[top.request.kind] : undefined);
}

/** WHY: `initial` stays the root's, since a changed `initial` makes gorhom snap on every push and pop. */
export function positionOf(profile: MapSheetProfile | null, root: SheetPosition): SheetPosition {
  if (!profile) return root;
  const expandableRoot = root.kind === 'expandable' ? root : null;
  return {
    kind: 'expandable',
    detents: sdsDetentsOf(profile.levels),
    initial: expandableRoot?.initial,
    heights: expandableRoot?.heights,
  };
}

/** WHY: built once, so a level's presentation keeps its identity across reads. */
const PRESENTATIONS = new WeakMap<MapSheetProfile, Readonly<Record<MapDetent, DetentPresentation>>>();

function presentationsOf(profile: MapSheetProfile): Readonly<Record<MapDetent, DetentPresentation>> {
  const known = PRESENTATIONS.get(profile);
  if (known) return known;
  const top = profile.levels.at(-1);
  const of = (level: MapDetent): DetentPresentation => ({
    ...profile.at[level],
    chrome: level === 'page' ? 'none' : profile.chrome,
    listScrolls: level === top,
  });
  const built = { min: of('min'), mid: of('mid'), max: of('max'), page: of('page') };
  PRESENTATIONS.set(profile, built);
  return built;
}

export function presentationAt(profile: MapSheetProfile | null, level: MapDetent): DetentPresentation {
  return profile ? presentationsOf(profile)[level] : ROOT_PRESENTATION;
}

/** WHY: a tab root keeps the bar drawn over it; anything opened from it is drawn over the bar. */
export function coversTabBarOf(rootShown: boolean): boolean {
  return !rootShown;
}

/** WHY: SDS hands a glass sheet attached at `large` to gorhom's `detached` mode, which leaves no gap. */
export function floatingInset(position: SheetPosition, floatInset: number): number {
  switch (position.kind) {
    case 'expandable':
      return position.detents[position.detents.length - 1] === 'large' ? 0 : floatInset;
    case 'stuck':
      return 'detent' in position && position.detent === 'large' ? 0 : floatInset;
    case 'fit':
      return floatInset;
    case 'stops':
      // WHY: SDS takes a floating card's gap off a stop itself (`resolveSheetPosition`).
      return 0;
  }
}

/**
 * WHY: a sheet raised past the anchor covers the row rather than pushing it over the status bar; `defaults` is
 * passed in because this file runs without SDS.
 */
export function locateAnchorTopOf(
  position: SheetPosition,
  park: SheetDetent,
  containerHeight: number,
  defaults: Readonly<Record<'small' | 'medium', number>>,
  floatInset = 0,
): number {
  if (position.kind !== 'expandable') return 0;
  const detent = position.detents.includes(park) ? park : position.detents[0];
  if (detent === 'large') return 0;
  const height = position.heights?.[detent] ?? `${defaults[detent]}%`;
  return Math.max(0, containerHeight - coveredHeight(height, containerHeight, floatingInset(position, floatInset)));
}

function toPoints(height: string | number, containerHeight: number): number {
  return typeof height === 'number' ? height : (containerHeight * parseFloat(height)) / 100;
}

function coveredHeight(height: string | number, containerHeight: number, inset: number): number {
  return toPoints(height, containerHeight - inset) + inset;
}

/** WHY: `large` is 0: a sheet covering the whole map leaves nothing to frame in, and the tab bar alone pads. */
export function restingInsetOf(
  position: SheetPosition,
  opening: SheetDetent,
  containerHeight: number,
  defaults: Readonly<Record<'small' | 'medium', number>>,
  floatInset = 0,
): number {
  if (containerHeight <= 0) return 0;
  const inset = floatingInset(position, floatInset);
  switch (position.kind) {
    case 'expandable':
      return opening === 'large'
        ? 0
        : coveredHeight(position.heights?.[opening] ?? `${defaults[opening]}%`, containerHeight, inset);
    case 'stuck':
      if ('height' in position) return coveredHeight(position.height, containerHeight, inset);
      return position.detent === 'large' ? 0 : coveredHeight(`${defaults[position.detent]}%`, containerHeight, inset);
    case 'fit':
    case 'stops':
      return 0;
  }
}

export interface SeenSheet {
  bodies: readonly number[];
  topDetent: MapDetent | null;
  levels: string;
  snapKey: string;
}

/**
 * QUIRK(gorhom-bottom-sheet): it reads its detents on the UI thread a frame later, so a snap in the commit that
 * changed them waits a frame (`deferFrame`).
 */
export type SheetMove =
  | { kind: 'stay' }
  | { kind: 'snap'; to: MapDetent; cause: 'open' | 'reveal' | 'follow' | 'restack'; deferFrame: boolean };

const STAY: SheetMove = { kind: 'stay' };

/**
 * EVIDENCE: a view's own opening snap raced the reveal in one commit; a line at its page under a stop came back at
 * its opening (2026-10-24). `reported` tells the sheet's own writes from anyone else's.
 */
export function decideSheetMove(
  seen: SeenSheet | null,
  now: { layout: SheetStackLayout; levels: readonly MapDetent[]; snapKey: string; rootDetent: MapDetent | null },
  reported: { id: number; detent: MapDetent } | null,
): { seen: SeenSheet; move: SheetMove } {
  const { layout, levels, snapKey, rootDetent } = now;
  const top = layout.bodies.at(-1);
  const next: SeenSheet = {
    bodies: layout.bodies.map((entry) => entry.id),
    topDetent: top?.detent ?? null,
    levels: levels.join(','),
    snapKey,
  };
  const deferFrame = seen !== null && seen.snapKey !== snapKey;
  const snap = (to: MapDetent, cause: 'open' | 'reveal' | 'follow' | 'restack'): { seen: SeenSheet; move: SheetMove } => ({
    seen: next,
    move: { kind: 'snap', to, cause, deferFrame },
  });

  if (seen === null) return top ? snap(top.detent, 'open') : { seen: next, move: STAY };
  if (top?.id !== seen.bodies.at(-1)) {
    if (!top) return rootDetent ? snap(rootDetent, 'reveal') : { seen: next, move: STAY };
    return snap(top.detent, seen.bodies.includes(top.id) ? 'reveal' : 'open');
  }
  const written = top !== undefined && seen.topDetent !== top.detent;
  if (written && reported?.id === top.id && reported.detent !== top.detent) return snap(top.detent, 'follow');
  if (seen.levels !== next.levels) {
    const level = top?.detent ?? rootDetent;
    if (level) return snap(level, 'restack');
  }
  return { seen: next, move: STAY };
}

export function bodyLabelOf(layout: SheetStackLayout, views: Partial<MapSheetViewTable>): TranslationKey | null {
  const top = layout.bodies.at(-1);
  const def = top ? views[top.request.kind] : undefined;
  return def?.presentation === 'swap' ? def.label : null;
}

export interface TabSwitchSheets {
  containerHeight: number;
  outgoingTop: number;
  ownTop: number;
  live: MapDetent | null;
  aimed: MapDetent | null;
  reported: boolean;
}

/**
 * QUIRK(gorhom-bottom-sheet): a sheet mounted in the switch's commit, before gorhom lays it out, closes for the
 * session on a snap, so it rises to its own opening detent instead.
 */
export function tabSwitchSnap(sheets: TabSwitchSheets): { startHeight: number; level: MapDetent } | null {
  const { containerHeight, outgoingTop, ownTop, live, aimed, reported } = sheets;
  if (!reported) return null;
  const level = aimed ?? live;
  if (containerHeight <= 0 || outgoingTop <= 0 || outgoingTop >= containerHeight || level === null) return null;
  if (outgoingTop === ownTop) return null;
  return { startHeight: containerHeight - outgoingTop, level };
}


