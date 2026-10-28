/**
 * WHY: `large` is attached to the top safe area, not a percentage,
 * so one definition covers a modal portalled to the window and an inline sheet. Import-free, so it runs under plain `node --test`.
 */

export type SheetDetent = 'small' | 'medium' | 'large';

export type SheetPosition =
  /** QUIRK(gorhom-bottom-sheet): snap points must ascend and gorhom does not sort them, so order the detents low to high. */
  | {
      kind: 'expandable';
      detents: readonly [SheetDetent, SheetDetent, ...SheetDetent[]];
      initial?: SheetDetent;
      /** WHY: only the fractional heights can be overridden: `large` means attached, not a number, which the surface rule rests on. */
      heights?: Partial<Record<'small' | 'medium', string | number>>;
    }
  | { kind: 'stuck'; detent: SheetDetent }
  /** WHY: a custom height is never treated as `large`, whatever its value: it floats, and on a glass sheet it stays a card. */
  | { kind: 'stuck'; height: string | number }
  | { kind: 'fit' }
  /**
   * QUIRK(gorhom-bottom-sheet): gorhom snaps on every change of `initialIndex`, so a host that swaps stops under one sheet holds it constant.
   * A `page` may only be last, and a detached card's covered heights have its float gap taken off (`floatGap`).
   */
  | { kind: 'stops'; stops: readonly [SheetStop, SheetStop, ...SheetStop[]]; initialIndex: number };

export type SheetStop =
  | { kind: 'covered'; height: number | `${number}%`; label?: string; fill?: number }
  | { kind: 'page'; label?: string; fill?: number };

export function endsInPage(position: SheetPosition): boolean {
  return position.kind === 'stops' && position.stops[position.stops.length - 1]?.kind === 'page';
}

/** EVIDENCE: the centroids of the clusters the sheets had converged on by hand (38/45/45/50 and 50/62/72), so migrating a sheet moved it least. */
export const SHEET_DETENT_PERCENT: Readonly<Record<'small' | 'medium', number>> = {
  small: 45,
  medium: 65,
};

/** WHY: a percentage because there is no measured container yet to subtract a safe area from; close enough that its one frame is not a jump. */
export const SHEET_LARGE_PERCENT_FALLBACK = 92;

/** WHY: a page sheet takes the whole container, since its status-bar band is the page's and it pads its own content under it. */
export function largeHeightOf(containerHeight: number, topInset: number, pageAtTop: boolean): number | null {
  if (containerHeight <= 0) return null;
  return pageAtTop ? containerHeight : containerHeight - topInset;
}

export function detentSnapPoint(
  detent: SheetDetent,
  largeHeight: number | null,
  overrides?: Partial<Record<'small' | 'medium', string | number>>,
): string | number {
  if (detent === 'large') {
    return largeHeight != null && largeHeight > 0
      ? largeHeight
      : `${SHEET_LARGE_PERCENT_FALLBACK}%`;
  }
  return overrides?.[detent] ?? `${SHEET_DETENT_PERCENT[detent]}%`;
}

export interface ResolvedSheetPosition {
  snapPoints: (string | number)[] | undefined;
  enableDynamicSizing: boolean;
  initialIndex: number;
  lastIndex: number;
  stopLabels: readonly (string | undefined)[];
  fillByIndex: readonly number[] | null;
  /** WHY: only a sheet that attaches needs interpolation; every other sheet keeps one shape and goes to gorhom's `detached` mode. */
  attachesAtTop: boolean;
  /** WHY: not whether the user can swipe it away, a separate question gorhom answers with the same panning props. */
  movesBetweenDetents: boolean;
}

/** QUIRK(gorhom-bottom-sheet): a detached card's snap points are measured from a bottom edge raised by `bottomInset`, so covered heights take `floatGap` off. */
export function resolveSheetPosition(
  position: SheetPosition,
  largeHeight: number | null,
  floatGap = 0,
): ResolvedSheetPosition {
  if (position.kind === 'stops') {
    const { stops } = position;
    const attaches = endsInPage(position);
    const gap = attaches ? 0 : floatGap;
    return {
      snapPoints: stops.map((stop) => {
        if (stop.kind === 'page') {
          return largeHeight != null && largeHeight > 0 ? largeHeight : `${SHEET_LARGE_PERCENT_FALLBACK}%`;
        }
        return typeof stop.height === 'number' ? stop.height - gap : stop.height;
      }),
      // WHY: a dynamic detent gorhom inserted would shift every index the host reads by name.
      enableDynamicSizing: false,
      initialIndex: position.initialIndex,
      lastIndex: stops.length - 1,
      stopLabels: stops.map((stop) => stop.label),
      fillByIndex: stops.some((stop) => stop.fill !== undefined) ? stops.map((stop) => stop.fill ?? 0) : null,
      attachesAtTop: attaches,
      movesBetweenDetents: stops.length > 1,
    };
  }

  if (position.kind === 'fit') {
    return {
      snapPoints: undefined,
      enableDynamicSizing: true,
      initialIndex: 0,
      lastIndex: 0,
      stopLabels: [],
      fillByIndex: null,
      attachesAtTop: false,
      movesBetweenDetents: false,
    };
  }

  if (position.kind === 'stuck') {
    return {
      snapPoints: [
        'detent' in position
          ? detentSnapPoint(position.detent, largeHeight)
          : position.height,
      ],
      enableDynamicSizing: false,
      initialIndex: 0,
      lastIndex: 0,
      stopLabels: [],
      fillByIndex: null,
      attachesAtTop: 'detent' in position && position.detent === 'large',
      movesBetweenDetents: false,
    };
  }

  const { detents, initial, heights } = position;
  // WHY: an `initial` outside `detents` is a programming error the types cannot catch; the lowest detent is the harmless answer.
  const requested = initial != null ? detents.indexOf(initial) : 0;
  return {
    snapPoints: detents.map((d) => detentSnapPoint(d, largeHeight, heights)),
    enableDynamicSizing: false,
    initialIndex: requested === -1 ? 0 : requested,
    lastIndex: detents.length - 1,
    stopLabels: [],
    fillByIndex: null,
    attachesAtTop: detents[detents.length - 1] === 'large',
    movesBetweenDetents: true,
  };
}

/** WHY: a closed sheet (`-1`) rises to its lowest detent; the handle never closes one. */
export function steppedDetentIndex(
  index: number,
  lastIndex: number,
  step: 'increment' | 'decrement',
): number | null {
  const nearest = Math.max(-1, Math.round(index));
  const next = step === 'increment' ? nearest + 1 : nearest - 1;
  return next < 0 || next > lastIndex ? null : next;
}

/** WHY: the grabber already stands above the content and fades out at the page, so the spacer is the top inset less its row. */
export function pageSpacerHeight(topInset: number, handleHeight: number): number {
  return Math.max(0, topInset - handleHeight);
}
