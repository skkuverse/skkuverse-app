import { useCallback } from 'react';
import { logMarkerTap } from '@/platform/analytics';
import type { ChipSource } from '@/platform/analytics.types';
import { chipOfTap } from '../../chips.rules';
import { fedKindOf, fedPlaceLayers, toSheetRequestFromTap } from '../../map-task.rules';
import { openSheet, runChip as runChipIn } from '../../map.service';
import type { MapChip, MapConfig, MapTabId } from '../../map-config.types';
import type { MapOverlay, MarkerTap } from '../../overlay.types';
import type { MapSheetViewTable } from '../../sheet-views.types';
import type { TabScope } from '../../layers.rules';
import type { FedPlaces, MapCommands } from '../../map-host.types';
import { useStableHandler } from './useStableHandler';

interface UseMapTapsInputs {
  sheetViews: Partial<MapSheetViewTable>;
  tabScope: TabScope;
  mapConfig: MapConfig | null;
  activeTab: MapTabId;
  moveTo: MapCommands['moveTo'];
  lowerToReveal: MapCommands['lowerToReveal'];
  placesById: ReadonlyMap<string, MapOverlay>;
  fedPlaces: FedPlaces;
}

export function useMapTaps({
  sheetViews,
  tabScope,
  mapConfig,
  activeTab,
  moveTo,
  lowerToReveal,
  placesById,
  fedPlaces,
}: UseMapTapsInputs) {
  const runChip = useCallback(
    (chip: MapChip, source: ChipSource) =>
      runChipIn(chip, activeTab, source, { scope: tabScope, layers: mapConfig?.layers ?? [], moveTo, lowerToReveal }),
    [activeTab, tabScope, mapConfig, moveTo, lowerToReveal],
  );

  const handleChipPress = useCallback((chip: MapChip) => runChip(chip, 'row'), [runChip]);

  /** WHY: a pin opens on the focused tab's stack and never switches tab (ADR 0022 rule 3). */
  const handleMarkerTap = useStableHandler(
    (tap: MarkerTap) => {
      if (tap.kind === 'chip') {
        const chip = chipOfTap(tabScope, activeTab, mapConfig?.chips ?? [], tap.chipId);
        if (chip) runChip(chip, 'overlay');
        return;
      }
      const request = toSheetRequestFromTap(tap, (id) => placesById.get(id), sheetViews);
      if (!request) return;
      if (request.kind === 'skku_building') logMarkerTap(Number(request.placeId));
      // WHY: a pin is drawn only from the feed's places, so the feed has answered.
      const fed = fedKindOf(tap.kind);
      const layers = fed && sheetViews[fed]?.layersFromFeed ? (fedPlaceLayers(fedPlaces[fed], tap.placeId) ?? {}) : {};
      openSheet(activeTab, 'select', request, layers, sheetViews);
    },
  );

  return { runChip, handleChipPress, handleMarkerTap };
}
