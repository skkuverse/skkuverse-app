/** WHY: pure and import-free, so it runs in a Reanimated worklet and under plain `node --test`, where `'worklet'` is an inert string. */

/**
 * WHY: small, so the card reads as lifted off the screen, and not the tab bar's rail: matched on both axes the card reads as a panel
 * shrunk to fit the control below it. The bottom gap is per sheet.
 */
export const SHEET_FLOAT_INSET = 8;

/** EVIDENCE: the iOS 26 tab bar's corner, measured off a device screenshot (a capsule about 64 tall), so the two floating surfaces share one curve. */
export const SHEET_RADIUS_FLOATING = 32;

/** WHY: the attached sheet's radius as shipped, so the attached state is not a redesign of the expanded one. */
export const SHEET_RADIUS_ATTACHED = 20;

/**
 * EVIDENCE: the 402x874 screen's corner, the largest in the iOS 26 set; overshooting is invisible, undershooting clips the card.
 * A card inset by i stays inside a display of radius R only while its own radius is at least R - i; the tab bar, a capsule, is no guide.
 * Too small shows as the gap pinching shut diagonally at the corner while the straight edges keep it.
 */
export const DISPLAY_CORNER_RADIUS = 62;

export interface SheetChrome {
  /** WHY: exposed so a caller can ramp a gap this cannot know: multiply a float-state measurement by `1 - progress`. */
  progress: number;
  sideInset: number;
  radius: number;
  fillOpacity: number;
  handleOpacity: number;
}

const ATTACHED: SheetChrome = {
  progress: 1,
  sideInset: 0,
  radius: SHEET_RADIUS_ATTACHED,
  fillOpacity: 1,
  handleOpacity: 1,
};

/** WHY: the glass dissolves only over the final segment; from the first detent the middle one would be a muddy half-opaque panel. */
export function sheetPageProgress(index: number, lastIndex: number): number {
  'worklet';
  const raw = index - (lastIndex - 1);
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
}

export const PAGE_RAMP_START = 0.5;

/** WHY: ramping these from the second-last detent read as a sheet that stopped being a card the moment it left its resting height. */
export function sheetPageRamp(index: number, lastIndex: number): number {
  'worklet';
  const raw = (sheetPageProgress(index, lastIndex) - PAGE_RAMP_START) / (1 - PAGE_RAMP_START);
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
}

/**
 * QUIRK(gorhom-bottom-sheet): `animatedIndex` goes negative on an over-drag, where the floating card must stay, and is -1 before the first layout,
 * so this clamps and the caller handles the unmeasured case.
 */
export function sheetChromeAt(index: number, lastIndex: number, pageAtTop = false): SheetChrome {
  'worklet';
  // WHY: a single-detent sheet has no expanded state to float toward, so it degrades to the plain sheet.
  if (lastIndex <= 0) {
    return ATTACHED;
  }

  const progress = index <= 0 ? 0 : index >= lastIndex ? 1 : index / lastIndex;

  const fillOpacity = sheetPageProgress(index, lastIndex);
  const page = pageAtTop ? sheetPageRamp(index, lastIndex) : 0;

  const attachedRadius =
    SHEET_RADIUS_FLOATING +
    (SHEET_RADIUS_ATTACHED - SHEET_RADIUS_FLOATING) * progress;

  return {
    progress,
    sideInset: SHEET_FLOAT_INSET * (1 - progress),
    radius: attachedRadius * (1 - page),
    fillOpacity,
    handleOpacity: 1 - page,
  };
}

export function fillAt(index: number, fillByIndex: readonly number[]): number {
  'worklet';
  const last = fillByIndex.length - 1;
  if (last < 0) return 0;
  const clamped = index <= 0 ? 0 : index >= last ? last : index;
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, last);
  const from = fillByIndex[lower] ?? 0;
  const to = fillByIndex[upper] ?? 0;
  return from + (to - from) * (clamped - lower);
}

/** WHY: concentric with the display and never tighter than the top corners, or the screen's rounding cuts the bottom corners off. */
export function bottomCornerRadius(topRadius: number, bottomGap: number): number {
  'worklet';
  return Math.max(topRadius, DISPLAY_CORNER_RADIUS - bottomGap);
}

export type SheetCardKind = 'attached' | 'floating' | 'travelling';

export interface SheetCardShape {
  top: number;
  bottom: number;
  /** WHY: `null` where gorhom's body already ends at the card; only the travelling card is shorter than its body, which gorhom sizes to the top detent. */
  gap: number | null;
}

const ATTACHED_CARD: SheetCardShape = { top: SHEET_RADIUS_ATTACHED, bottom: 0, gap: null };

/**
 * WHY: one outline for every background and the content clip, so the two cannot disagree; a page squares the top corners,
 * or the map shows behind the status bar as two wedges.
 */
export function sheetCardShape(
  kind: SheetCardKind,
  index: number,
  lastIndex: number,
  pageAtTop: boolean,
  floatBottomGap: number,
): SheetCardShape {
  'worklet';
  const page = pageAtTop && lastIndex > 0 ? sheetPageRamp(index, lastIndex) : 0;
  if (kind === 'attached') return page === 0 ? ATTACHED_CARD : { ...ATTACHED_CARD, top: SHEET_RADIUS_ATTACHED * (1 - page) };
  if (kind === 'floating') {
    return {
      top: SHEET_RADIUS_FLOATING * (1 - page),
      bottom: bottomCornerRadius(SHEET_RADIUS_FLOATING, floatBottomGap),
      gap: null,
    };
  }
  const { progress, radius } = sheetChromeAt(index, lastIndex, pageAtTop);
  const gap = floatBottomGap * (1 - progress);
  return { top: radius, bottom: bottomCornerRadius(radius, gap), gap };
}

/** WHY: each clip runs this far past the content to hide the corners it does not own, so it must be at least every radius `sheetCardShape` returns. */
export const SHEET_CLIP_REACH = DISPLAY_CORNER_RADIUS;

export interface SheetContentFrame {
  /** QUIRK(gorhom-bottom-sheet): 0 or less before it is measured. */
  containerHeight: number;
  bodyTop: number;
  /** QUIRK(gorhom-bottom-sheet): negative before it is measured. */
  handleHeight: number;
  contentHeight: number;
}

export interface SheetContentClip {
  top: number;
  bottom: number;
  overhang: number;
}

/** WHY: the content starts `handleHeight` below the card's top, so its top corner is the card's less that and sits inside the card's curve. */
export function sheetContentClip(
  kind: SheetCardKind,
  index: number,
  lastIndex: number,
  pageAtTop: boolean,
  floatBottomGap: number,
  frame: SheetContentFrame,
): SheetContentClip {
  'worklet';
  const measured = frame.containerHeight > 0;
  const card = sheetCardShape(
    kind === 'travelling' && !measured ? 'attached' : kind,
    index,
    lastIndex,
    pageAtTop,
    floatBottomGap,
  );
  const handle = frame.handleHeight > 0 ? frame.handleHeight : 0;
  const top = card.top > handle ? card.top - handle : 0;
  if (card.gap === null || frame.contentHeight <= 0) return { top, bottom: card.bottom, overhang: 0 };
  const contentBottom = frame.bodyTop + handle + frame.contentHeight;
  const cardBottom = frame.containerHeight - card.gap;
  const overhang = contentBottom > cardBottom ? contentBottom - cardBottom : 0;
  return { top, bottom: card.bottom, overhang };
}
