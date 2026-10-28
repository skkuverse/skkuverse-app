import { timingConfig } from '../../foundation/easings';

/**
 * SEE: docs/explanation/bottom-sheet-system.md ("The campus sheet steps aside for a detail sheet"): two sheets never stack, so the incoming
 * one rises only once the outgoing one has landed; timings, not springs, give that gate a length it can state (about 0.4 s for the pair).
 */
export const SHEET_HANDOFF_CLOSE = timingConfig('out', 150);

export const SHEET_HANDOFF_RISE = timingConfig('expo', 250);

/** QUIRK(gorhom-bottom-sheet): gorhom's iOS default snap (`Easing.out(Easing.exp)`, 250 ms), restated so a tab switch moves like the sheet's own snaps. */
export const SHEET_TAB_SWITCH = timingConfig('expo', 250);
