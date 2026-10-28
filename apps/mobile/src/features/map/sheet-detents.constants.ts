/**
 * WHY: one vocabulary for every map sheet; a kind chooses levels, never a height. SDS keeps its own detents for
 * window modals, whose `large` means attached to the top.
 */

export type MapDetent = 'min' | 'mid' | 'max' | 'page';

export const MAP_DETENT_RANK: Readonly<Record<MapDetent, number>> = { min: 0, mid: 1, max: 2, page: 3 };

export const REVEAL: MapDetent = 'min';

/**
 * WHY: 55% fits every live line's whole route above the sheet; gorhom resolves it against the container,
 * which equals the window on iOS, where it was measured.
 */
export const MID_PERCENT = 55;

/**
 * EVIDENCE: the campus sheet's old 24% floor on the reference phone (874 x 0.24 - 22 handle - 99 clearance),
 * so the common resting sheet does not move there, and other heights show the same body.
 */
export const MIN_BODY_PT = 88;

/** WHY: `min`'s stand-in is the reference phone's computed value, so the sheet does not move when the overlap lands. */
export const STAND_IN_PERCENT = { min: 24, mid: MID_PERCENT, max: 80 } as const;

export const SHEET_CONTENT_BOTTOM = 32;

/** QUIRK(naver-map): `-[NMFMapView setLogoMargin:]` floors the logo margin at 9 pt top and bottom (NMapsMap 3.23.2). */
export const NAVER_LOGO_MARGIN = 9;

/** QUIRK(naver-map): the same setter floors the side margin at 12 pt. */
export const NAVER_LOGO_SIDE_MARGIN = 12;

/**
 * EVIDENCE: the 8 pt wordmark sits 3 pt below where the SDK hangs it with 3 pt clear (iPhone 17 Pro simulator,
 * 2026-10-25).
 */
export const NAVER_LOGO_HEIGHT = 14;

export const LOCATE_PARK: MapDetent = 'mid';

/** WHY: glass while the map shows around a sheet, solid from `max`; without Liquid Glass every level is solid. */
export const LEVEL_SURFACE: Readonly<Record<MapDetent, 'glass' | 'solid'>> = {
  min: 'glass',
  mid: 'glass',
  max: 'solid',
  page: 'solid',
};
