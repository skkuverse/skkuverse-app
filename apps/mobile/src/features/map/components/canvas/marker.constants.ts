/**
 * WHY: one file for the renderers and `apps/mobile/scripts/export-marker-icons.mjs`, so an asset and its drawn
 * size cannot drift; it imports nothing, so the script loads it under Node's type stripping. Points throughout.
 */

/** QUIRK(naver-map): a marker's touch area is its icon, not its opaque pixels, so the canvas margin is the tap target. */
export const BUS_STOP_DOT = { disc: 24, canvas: 36 } as const;

/** WHY: the canvas is the tap target and never under 32, since the disc is far smaller than a thumb. */
export const ROUTE_STOP_DOT = { disc: 8, ring: 1.5, canvas: 32 } as const;

export const BUS_STOP_PIN = { width: 36, height: 48 } as const;

/** WHY: a 0.9-1.2x stretch of `bakedWidth` keeps the border visually 1 pt. */
export const LABEL_BOX = { height: 28, paddingX: 8, textSize: 12, radius: 4, border: 1, bakedWidth: 112 } as const;

export const STOP_CAPTION_SIZE = 11;
export const FOCUSED_CAPTION_SIZE = 12;

/** WHY: the tintable base icon's natural proportions, so the tint is not distorted. */
export const PIN_WIDTH = 22;

export const PIN_HEIGHT = 30;

export const DOT_DIAMETER = 18;

/**
 * WHY: the asset's transparent padding is the tap target. A ratio, not a second constant, because `size`
 * is the server's to set and a fixed canvas could drift from it.
 */
export const DOT_CANVAS_RATIO = 28 / 18;

export const BADGED_CIRCLE = { circle: 16, canvas: 24, badge: 11, ring: 1.2, offset: 6, textSize: 7.5 } as const;

export const BADGE_COUNT_MAX = 9;

/**
 * WHY: `zIndex`, not `globalZIndex`: that moves a marker between the SDK's overlay layers, and the text
 * labels already sit at 100000 there, so it would reorder names against pins.
 */
export const SELECTED_Z = 1000;

/**
 * WHY: no colour here or on the wire for the building layers: it falls back to `bg.dataBrand`, a token
 * that resolves per theme, which a server hex cannot.
 */
export const NUMBER_CIRCLE_SIZE = 16;

/** WHY: a ratio, because `size` is the server's to set; 7/16 gives 7pt at a 16pt circle. */
export const NUMBER_CIRCLE_TEXT_RATIO = 7 / 16;

export const LABEL_Z_INDEX = 100000;

/**
 * EVIDENCE: swept against the 61 real booth titles and the building names; at these values no wrap leaves a
 * one-syllable widow. A narrower caption also collides less, and a collision hides the whole label.
 */
export const CAPTION_COLS = { textLabel: 14, placeDot: 16 } as const;

export const CAPTION_MAX_LINES = 2;

/**
 * QUIRK(naver-map): `0` turns off the SDK's wrapper, which breaks only at whitespace; `wrapMarkerLabel` breaks
 * lines, and a second wrapper would make the breaks non-deterministic.
 */
export const NO_NATIVE_WRAP = 0;

export const TIP_ANCHOR = { x: 0.5, y: 1 } as const;

/**
 * QUIRK(naver-map): markers sit at a global z of 200000 and the location overlay at 300000, so a label
 * covers the stop pins beside it and never the user's own position.
 */
export const LABEL_GLOBAL_Z = 250000;

export const DEFAULT_LABEL_GAP = 4;

/**
 * WHY: read off `style.width`, the pin width, since no layer draws both a pin and a path; a layer that
 * needs both needs a `strokeWidth` on the wire.
 */
export const DEFAULT_STROKE = 4;
