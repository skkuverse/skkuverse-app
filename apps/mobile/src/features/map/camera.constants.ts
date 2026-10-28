/**
 * EVIDENCE: below every campus's `defaultZoom` and the ~12.5 a 2.1 km city bus route needs in an iPhone SE's
 * 55% band (`route-framing.test.ts`); 14 clamped every route fit (simulator, 2026-10-24). The served route
 * layers' `style.minZoom` must be at most this.
 */
export const MIN_CAMERA_ZOOM = 12;

export const MAP_FRAME_MARGIN = 32;

/**
 * EVIDENCE: on an 874 pt window (simulator, 2026-10-24) a 55% line sheet leaves about 247 under the world's
 * rows and a 70% sheet about 37; below this floor the padding drops the sheet (`visibleMapPadding`).
 */
export const MIN_VISIBLE_BAND = 120;

/**
 * WHY: switching tracking on emits an idle at the old position, so a request outlives the first settle; the
 * window stops it from outliving its press. Sized for a locate, which covers the animation and the first fix.
 */
export const EXPLICIT_CAMERA_RESULT_WINDOW_MS = 6000;

/**
 * EVIDENCE: the SDK reports a heading set to 6 as 6.000000000000001 (iOS simulator, 2026-09-26), so exact
 * comparison sent every bearing-6 chip down the prop path, which has no duration.
 */
export const ATTITUDE_TOLERANCE_DEG = 0.01;

/** WHY: about 0.1 mm on the ground. */
export const REPEAT_NUDGE_DEG = 1e-9;

/** WHY: about 55 m; fit-bounds on a smaller box picks the SDK's maximum zoom, which reads as pavement. */
export const POINT_SPAN_DEG = 0.0005;

/** WHY: "about 1 km" (ADR 0022 d1). */
export const NEAR_SERVED_PLACE_M = 1000;

/** WHY: a start at the user after this would yank a map the user may already be reading. */
export const LAUNCH_FIX_TIMEOUT_MS = 1500;

export const LAUNCH_PLACES_WAIT_MS = 2500;

/**
 * EVIDENCE: the reference (Naver Map, a stop on a city bus line) shows 0.90 m/pt, which is zoom 16.1 at this
 * latitude (62024 / 2^zoom m/pt, simulator 2026-10-24); 17 opened twice as close. `markerFocus` frames a
 * building, and a stop needs its neighbours in view.
 */
export const STOP_FOCUS_ZOOM = 16;

/**
 * EVIDENCE: route frames fit at 12.71-13.29 for the city lines at the 55% detent and 13.46 at 30%, HSSC at
 * 14.28 (iPhone 17 Pro simulator, 2026-10-24); 13.4 sits in the gap, so HSSC's eleven stops keep their pins.
 */
export const STOP_PIN_MIN_ZOOM = 13.4;
