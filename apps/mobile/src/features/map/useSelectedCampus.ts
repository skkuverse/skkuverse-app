import type { Campus } from '@skkuverse/shared';
import { useMapStore } from './map.store';

/** WHY: read-only; the map host and its toggle are its only writers (ADR 0022 d5). */
export function useSelectedCampus(): Campus {
  return useMapStore((s) => s.selectedCampus);
}
