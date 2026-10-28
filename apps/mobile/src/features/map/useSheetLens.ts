/**
 * WHY: stays while the entry is on the stack, even after the view unmounts under a pushed sheet. Memoise `lens`,
 * or every render republishes.
 */

import { useEffect } from 'react';
import { useMapStore } from './map.store';
import type { MapTabId } from './map-config.types';
import type { MapOverlayLens } from './sheet-stack.types';
import { useMapRegistry } from './useMapRegistry';

export function useSheetLens(tab: MapTabId, entryId: number, lens: MapOverlayLens | null): void {
  const { publishLens } = useMapRegistry();
  useEffect(() => {
    publishLens(tab, entryId, lens);
    return () => {
      // WHY: read at cleanup, since a pop has already left the store when the view unmounts.
      const onStack = useMapStore.getState().tasks[tab].stack.some((e) => e.id === entryId);
      if (!onStack) publishLens(tab, entryId, null);
    };
  }, [publishLens, tab, entryId, lens]);
}
