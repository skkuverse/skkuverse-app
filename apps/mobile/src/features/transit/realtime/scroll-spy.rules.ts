import { STATION_ROW_HEIGHT } from './marker-geometry.rules';
import type { LineSection } from './line.rules';

/**
 * WHY: follows Bootstrap v4.6.2 scrollspy `_process()` (offset added to both positions, last target at
 * max scroll), except that before the first offset it shows the first tab, since a tab bar always shows one.
 */
export function activeSectionAt(offsets: readonly number[], scrollTop: number, maxScroll: number): number {
  if (offsets.length === 0) return -1;
  if (scrollTop >= maxScroll) return offsets.length - 1;
  for (let i = offsets.length; i--; ) {
    const next = offsets[i + 1];
    if (scrollTop >= offsets[i]! && (next === undefined || scrollTop < next)) return i;
  }
  return 0;
}

/** WHY: Bootstrap's `offset` in row units: the tab switches within half a row of the viewport's top, not half the viewport. */
export const SPY_OFFSET = STATION_ROW_HEIGHT / 2;

// WHY: rows are a fixed `STATION_ROW_HEIGHT`, so no measuring.
export function sectionOffsets(sections: readonly LineSection[], rowHeight: number): number[] {
  return sections.map((s) => s.firstRow * rowHeight);
}

export type SpyState = { kind: 'following'; section: number } | { kind: 'held'; section: number; y: number };

export type SpyEvent =
  | { type: 'spy'; section: number; y: number }
  | { type: 'tap'; section: number; y: number; fromY: number }
  | { type: 'drag' }
  | { type: 'top' };

// WHY: an offset converted from pixels can miss a hold's `y` by a fraction.
const LANDED_TOLERANCE = 1;

const landed = (y: number, target: number) => Math.abs(y - target) <= LANDED_TOLERANCE;

/**
 * WHY: a tap that needs no scroll never holds, since no scroll event would end it; an unchanged
 * state is returned as the same object so the view does not re-render.
 */
export function spyReduce(state: SpyState, event: SpyEvent): SpyState {
  switch (event.type) {
    case 'tap':
      return landed(event.fromY, event.y)
        ? { kind: 'following', section: event.section }
        : { kind: 'held', section: event.section, y: event.y };
    case 'drag':
      return state.kind === 'held' ? { kind: 'following', section: state.section } : state;
    case 'top':
      // WHY: the scroll up ran under the hold, so no reading has followed it.
      return state.kind === 'following' && state.section === 0 ? state : { kind: 'following', section: 0 };
    case 'spy':
      if (state.kind === 'held') {
        return event.section === state.section || landed(event.y, state.y)
          ? { kind: 'following', section: state.section }
          : state;
      }
      return event.section === state.section ? state : { kind: 'following', section: event.section };
  }
}

/** WHY: a tab press never moves the sheet, so the map's stops are seen to swap; below the top detent the sheet locks the list. */
export type TabPressScroll = { kind: 'scroll'; y: number } | { kind: 'hold'; y: number };

export function tabPressScroll(atTop: boolean, y: number): TabPressScroll {
  return atTop ? { kind: 'scroll', y } : { kind: 'hold', y };
}

/**
 * QUIRK(ios): `scrollToOffset` hands the offset straight to `setContentOffset:animated:`, which does not clamp,
 * so a section the list cannot bring to the top would scroll into blank space.
 */
export function tapScrollY(offset: number, contentHeight: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return offset;
  return Math.min(offset, Math.max(0, contentHeight - viewportHeight));
}

// WHY: `body` is measured inside the padding so the padding never feeds back into it.
export type ListMeasure = { viewport: number; body: number; sectionOffsets: readonly number[] };

/**
 * WHY: without room for the last section's first row to reach the top, a tap on a short line's last tab clamps
 * short and shows an earlier section; unmeasured the base stands, as a guess is a gap a long line drops a frame later.
 */
export function listBottomPadding(base: number, { viewport, body, sectionOffsets }: ListMeasure): number {
  const lastSection = sectionOffsets.length > 1 ? sectionOffsets[sectionOffsets.length - 1] : undefined;
  if (lastSection === undefined || viewport <= 0 || body <= 0) return base;
  return Math.max(base, viewport - (body - lastSection));
}
