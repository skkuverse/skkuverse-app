/** WHY: the one place a gorhom index becomes a level name and back; a worklet reads the per-index tables. */

import type { SheetPosition, SheetStop } from '@skkuverse/sds';
import {
  MAP_DETENT_RANK,
  MID_PERCENT,
  MIN_BODY_PT,
  NAVER_LOGO_HEIGHT,
  NAVER_LOGO_MARGIN,
  SHEET_CONTENT_BOTTOM,
  STAND_IN_PERCENT,
  type MapDetent,
} from './sheet-detents.constants';
import type { MapSheetProfile } from './sheet-stack.constants';
import { locateAnchorTopOf, positionOf, restingInsetOf } from './sheet-stack.rules';

export interface RootSheet {
  profile: MapSheetProfile;
  legacyPosition: SheetPosition | null;
}

export interface LegacyRootSheet {
  profile: MapSheetProfile;
  position: SheetPosition;
}

export interface MapSheetStops {
  levels: readonly MapDetent[];
  position: SheetPosition;
  bodyReveal: readonly number[];
  fill: readonly number[];
  pageIndex: number;
  /** WHY: only at a tab root's top level does gorhom let its list scroll; a pushed body drives only as a page. */
  barIndex: number;
}

/**
 * WHY: the native-tabs shell keeps the heights it had before the one scale (ADR 0024) until its own sign-off;
 * `__fixtures__/sheet-positions.golden.json` pins them; this path goes when that shell moves to the scale or retires.
 */
export function toLegacyStops(
  body: MapSheetProfile | null,
  root: LegacyRootSheet,
): MapSheetStops {
  const profile = body ?? root.profile;
  const { levels } = profile;
  const pageIndex = levels.indexOf('page');
  return {
    levels,
    position: positionOf(body, root.position),
    bodyReveal: levels.map((level) => (profile.at[level].body === 'full' ? 1 : 0)),
    fill: levels.map((level) => fillOf(profile, level)),
    pageIndex,
    barIndex: body ? pageIndex : levels.length - 1,
  };
}

export interface DetentMeasure {
  containerHeight: number;
  controlsBottom: Readonly<Record<'world' | 'taskField', number>>;
  minFrame: number | null;
}

export function contentBottomOf(tabBarOverlap: number): number {
  return Math.max(SHEET_CONTENT_BOTTOM, tabBarOverlap + 16);
}

/** WHY: NAVER's terms forbid covering the logo, so `max` rests a margin under its band; only a page covers it. */
export function logoBandOf(controlsBottom: number): { paddingTop: number; logoBottom: number; maxTop: number } {
  const logoBottom = controlsBottom + NAVER_LOGO_HEIGHT;
  return { paddingTop: controlsBottom - NAVER_LOGO_MARGIN, logoBottom, maxTop: logoBottom + NAVER_LOGO_MARGIN };
}

export function coveredHeightAt(level: MapDetent, chrome: 'world' | 'taskField', m: DetentMeasure): number | `${number}%` {
  const { containerHeight } = m;
  if (level === 'page') return containerHeight > 0 ? containerHeight : '100%';
  if (containerHeight <= 0) return `${STAND_IN_PERCENT[level]}%`;
  switch (level) {
    case 'min':
      return m.minFrame === null ? (containerHeight * STAND_IN_PERCENT.min) / 100 : m.minFrame + MIN_BODY_PT;
    case 'mid':
      return (containerHeight * MID_PERCENT) / 100;
    case 'max':
      return containerHeight - logoBandOf(m.controlsBottom[chrome]).maxTop;
  }
}

/**
 * WHY: a level that does not rise a point above the one below is left out; `openingIndex` is the root's for every
 * body, since gorhom snaps whenever its index prop changes.
 */
export function toMapSheetStops(
  body: MapSheetProfile | null,
  root: MapSheetProfile,
  m: DetentMeasure,
  labels: Readonly<Record<MapDetent, string>>,
): MapSheetStops {
  const profile = body ?? root;
  const stopOf = (level: MapDetent): SheetStop =>
    level === 'page'
      ? { kind: 'page', label: labels.page, fill: fillOf(profile, level) }
      : { kind: 'covered', height: coveredHeightAt(level, profile.chrome, m), label: labels[level], fill: fillOf(profile, level) };
  const all = profile.levels.map((level) => ({ level, stop: stopOf(level) }));
  let kept: typeof all = [];
  let below = -Infinity;
  for (const entry of all) {
    const height = entry.stop.kind === 'covered' && typeof entry.stop.height === 'number' ? entry.stop.height : null;
    if (height !== null && kept.length > 0 && height < below + 1) continue;
    if (height !== null) below = height;
    kept.push(entry);
  }
  // QUIRK(gorhom-bottom-sheet): it needs two stops, so a squeezed sheet keeps its lowest and its top.
  if (kept.length < 2) kept = [all[0]!, all[all.length - 1]!];
  const levels = kept.map((entry) => entry.level);
  const [first, second, ...rest] = kept.map((entry) => entry.stop);
  const pageIndex = levels.indexOf('page');
  const openingIndex = root.levels.indexOf(root.opening);
  return {
    levels,
    position: {
      kind: 'stops',
      stops: [first!, second!, ...rest],
      initialIndex: Math.min(Math.max(openingIndex, 0), levels.length - 1),
    },
    bodyReveal: levels.map((level) => (profile.at[level].body === 'full' ? 1 : 0)),
    fill: levels.map((level) => fillOf(profile, level)),
    pageIndex,
    barIndex: body ? pageIndex : levels.length - 1,
  };
}

const NO_LABELS: Readonly<Record<MapDetent, string>> = { min: '', mid: '', max: '', page: '' };

export function stopsOf(
  body: MapSheetProfile | null,
  root: RootSheet,
  table: DetentMeasure,
  labels: Readonly<Record<MapDetent, string>> = NO_LABELS,
): MapSheetStops {
  if (root.legacyPosition) return toLegacyStops(body, { profile: root.profile, position: root.legacyPosition });
  return toMapSheetStops(body, root.profile, table, labels);
}

function fillOf(profile: MapSheetProfile, level: MapDetent): number {
  return profile.at[level].surface === 'solid' ? 1 : 0;
}

export function levelAtIndex(stops: MapSheetStops, index: number): MapDetent | null {
  if (index < 0) return null;
  return stops.levels[index] ?? null;
}

export function indexOfLevel(stops: MapSheetStops, level: MapDetent): number {
  const exact = stops.levels.indexOf(level);
  if (exact !== -1) return exact;
  let below = 0;
  stops.levels.forEach((candidate, index) => {
    if (MAP_DETENT_RANK[candidate] < MAP_DETENT_RANK[level]) below = index;
  });
  return below;
}

export function nearestLevel(stops: MapSheetStops, liveIndex: number): MapDetent | null {
  const index = Math.round(liveIndex);
  if (index < 0) return null;
  return stops.levels[Math.min(index, stops.levels.length - 1)] ?? null;
}

export function openingLevel(requested: MapDetent, stops: MapSheetStops, screenReader: boolean): MapDetent {
  return screenReader ? (stops.levels.at(-1) ?? requested) : requested;
}

function sdsDetentAt(stops: MapSheetStops, level: MapDetent) {
  const { position } = stops;
  return position.kind === 'expandable' ? position.detents[indexOfLevel(stops, level)] : undefined;
}

export function coveredAt(
  stops: MapSheetStops,
  level: MapDetent,
  containerHeight: number,
  defaults: Readonly<Record<'small' | 'medium', number>>,
  floatInset = 0,
): number {
  const { position } = stops;
  if (position.kind !== 'stops') {
    return restingInsetOf(position, sdsDetentAt(stops, level) ?? 'small', containerHeight, defaults, floatInset);
  }
  if (containerHeight <= 0) return 0;
  const stop = position.stops[indexOfLevel(stops, level)];
  if (!stop || stop.kind === 'page') return 0;
  return typeof stop.height === 'number' ? stop.height : (containerHeight * parseFloat(stop.height)) / 100;
}

export function parkTopOf(
  stops: MapSheetStops,
  park: MapDetent,
  containerHeight: number,
  defaults: Readonly<Record<'small' | 'medium', number>>,
  floatInset = 0,
): number {
  if (stops.position.kind === 'stops') return Math.max(0, containerHeight - coveredAt(stops, park, containerHeight, defaults));
  return locateAnchorTopOf(stops.position, sdsDetentAt(stops, park) ?? 'small', containerHeight, defaults, floatInset);
}

/** QUIRK(gorhom-bottom-sheet): the index is interpolated off the position, so a resting float can land a hair short. */
const INDEX_TOLERANCE = 0.01;

export function bodyRevealAt(index: number, reveal: readonly number[]): number {
  'worklet';
  const last = reveal.length - 1;
  if (last < 0) return 1;
  const clamped = index <= 0 ? 0 : index >= last ? last : index;
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, last);
  const from = reveal[lower] ?? 1;
  const to = reveal[upper] ?? 1;
  return from + (to - from) * (clamped - lower);
}

export function drivesBarAt(index: number, barIndex: number): boolean {
  'worklet';
  return barIndex >= 0 && index >= barIndex - INDEX_TOLERANCE;
}
