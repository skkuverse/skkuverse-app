/**
 * QUIRK(ios): the numbers are UIKit's iOS 26 bar as Liquidum 0.2.2 (MIT, github.com/mohamedalsamrai/liquidum)
 * measures it, not the SDS scale. WHY: `indexAtX` derives from expo-glass-tabs 0.1.1 (MIT, LICENSE beside this file).
 */

export interface SafeAreaEdges {
  left: number;
  right: number;
  bottom: number;
}

export interface HorizontalFrame {
  left: number;
  width: number;
}

export interface TabBarGeometry {
  frame: { left: number; right: number; bottom: number; width: number; height: number };
  pad: number;
  innerWidth: number;
  cells: HorizontalFrame[];
  lens: { width: number; height: number; pitch: number; top: number };
  glyphOffsets: number[];
  // WHY: the expanded capsule's, which the minimized one shrinks into, so a scroll never re-lays a page out.
  inset: number;
  minimizedScale: number;
  minimizedTopDrop: number;
}

// EVIDENCE: Liquidum lib/src/tab_bar/tab_bar.dart:72.
export const BAR_HEIGHT = 62;

// EVIDENCE: Liquidum physics.dart:35.
export const BAR_PAD = 4;

export const LENS_HEIGHT = BAR_HEIGHT - 2 * BAR_PAD;

// EVIDENCE: UIKit floats its bar 21pt from the sides and bottom, 13pt into a 34pt safe area (Liquidum tab_scaffold.dart:431-443).
const FLOAT_MARGIN = 21;
const INDICATOR_OVERLAP = 13;

// EVIDENCE: Instagram's compact bar, measured from a recording; union-tab-view draws it as 152/180.
export const MINIMIZED_SCALE = 0.84;

function floatingMargin(insets: SafeAreaEdges): { left: number; right: number; bottom: number } {
  return {
    left: FLOAT_MARGIN + insets.left,
    right: FLOAT_MARGIN + insets.right,
    bottom: Math.max(FLOAT_MARGIN, insets.bottom - INDICATOR_OVERLAP),
  };
}

function tabCells(barWidth: number, count: number): HorizontalFrame[] {
  const width = barWidth / count;
  return Array.from({ length: count }, (_, index) => ({ left: index * width, width }));
}

// EVIDENCE: Liquidum physics.dart:75-83, without a search tab.
function lensOverlap(count: number): number {
  if (count <= 3) return 8 * (count - 1);
  return count === 4 ? 40 : 33;
}

// EVIDENCE: Liquidum physics.dart:63-73; four tabs in 352pt land where the iOS 26.5 bar draws them on an iPhone 17 Pro.
function lensGeometry(innerWidth: number, count: number): { width: number; pitch: number } {
  const width = Math.min((innerWidth + lensOverlap(count)) / count, innerWidth);
  const pitch = count > 1 ? (innerWidth - width) / (count - 1) : 0;
  return { width, pitch };
}

export function tabBarGeometry(insets: SafeAreaEdges, windowWidth: number, count: number): TabBarGeometry {
  const margin = floatingMargin(insets);
  const width = Math.max(windowWidth - margin.left - margin.right, 0);
  const innerWidth = Math.max(width - 2 * BAR_PAD, 0);
  const cells = tabCells(width, count);
  const lens = { ...lensGeometry(innerWidth, count), height: LENS_HEIGHT, top: BAR_PAD };
  // QUIRK(ios): UIKit centres a glyph in its overlapping lens, not its equal cell, so the outer tabs lean inward.
  const glyphOffsets = cells.map(
    (cell, index) => BAR_PAD + index * lens.pitch + lens.width / 2 - (cell.left + cell.width / 2),
  );
  // WHY: Liquidum takes the deeper of this and the safe area, but the bar's top edge is always the deeper here.
  const inset = margin.bottom + BAR_HEIGHT;
  return {
    frame: { ...margin, width, height: BAR_HEIGHT },
    pad: BAR_PAD,
    innerWidth,
    cells,
    lens,
    glyphOffsets,
    inset,
    minimizedScale: MINIMIZED_SCALE,
    minimizedTopDrop: (BAR_HEIGHT * (1 - MINIMIZED_SCALE)) / 2,
  };
}

// WHY: on the lens pitch, not an equal share of the width, which put the finger up to 5pt off the outer lenses.
export function indexAtX(x: number, geometry: TabBarGeometry): number {
  'worklet';
  const count = geometry.cells.length;
  if (count <= 1 || geometry.lens.pitch <= 0) return 0;
  const raw = (x - geometry.pad - geometry.lens.width / 2) / geometry.lens.pitch;
  return Math.min(Math.max(raw, 0), count - 1);
}

export function lensLeft(geometry: TabBarGeometry, index: number): number {
  'worklet';
  return index * geometry.lens.pitch;
}
