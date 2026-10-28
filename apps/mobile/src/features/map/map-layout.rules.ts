import { CHIP_ROW_HEIGHT, MAP_TOP_INSET_GAP, MAP_TOP_ROW_GAP } from './map-layout.constants';

/**
 * WHY: arithmetic, not a measurement, which arrives a layout after the sheet mounts and moves with every
 * config load; `MapHost` checks it against the measured edge in development.
 */
export function controlsBottomOf(
  chrome: 'world' | 'taskField',
  c: { topInset: number; toolbarHeight: number; chipRow: boolean },
): number {
  const chips = chrome === 'world' && c.chipRow ? MAP_TOP_ROW_GAP + CHIP_ROW_HEIGHT : 0;
  return c.topInset + MAP_TOP_INSET_GAP + c.toolbarHeight + chips + MAP_TOP_ROW_GAP;
}
