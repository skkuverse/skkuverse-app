import { GLASS_BUTTON_GROUP_SIZE, GLASS_CHIP_HEIGHT } from '@skkuverse/sds';

/** WHY: one height for every piece of the control row, so they read as one control set and cannot drift. */
export const MAP_CONTROL_HEIGHT = 40;

/** WHY: the 44 pt touch target the pill's buttons need (ADR 0022 d1). */
export const MAP_TOOLBAR_HEIGHT = GLASS_BUTTON_GROUP_SIZE;

export const MAP_CONTROL_GAP = 12;

export const MAP_TOP_INSET_GAP = 6;

/** WHY: wider than the gap above the toggle, so the chips do not read as a third row of the toggle's set. */
export const MAP_TOP_ROW_GAP = 10;

/** WHY: the host lays the controls' bottom edge out from it rather than measuring it. */
export const CHIP_ROW_HEIGHT = GLASS_CHIP_HEIGHT;

export const MAP_SCREEN_GUTTER = 16;

export const MAP_CHROME_FADE_MS = 150;
