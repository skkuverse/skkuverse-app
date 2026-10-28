/** WHY: one source for what the list renders and what its tracking reads, so they agree on when it is up. */

import { useMemo } from 'react';
import { isEventListShown, selectVisibleOverlays } from './event-list.rules';
import { useMapStore } from '../map.store';
import type { MapSheetEntryOf } from '../sheet-stack.types';
import { useMapWorld } from '../useMapWorld';

export function useEventListRows(entry: MapSheetEntryOf<'chip'>) {
  const { mapConfig, eventPlaces, now, layerState } = useMapWorld();
  const selectedCampus = useMapStore((s) => s.selectedCampus);

  const chip = useMemo(
    () => mapConfig?.chips.find((c) => c.id === entry.request.chipId) ?? null,
    [mapConfig, entry.request.chipId],
  );

  const layerPlaces = useMemo(
    () =>
      mapConfig
        ? selectVisibleOverlays({ markers: eventPlaces.overlays, layers: mapConfig.layers, state: layerState, now })
        : [],
    [mapConfig, eventPlaces.overlays, layerState, now],
  );

  const showList = isEventListShown({
    chipServed: chip !== null,
    overlays: eventPlaces.overlays,
    listed: layerPlaces,
    campus: selectedCampus,
  });

  return { chip, layerPlaces, showList };
}
