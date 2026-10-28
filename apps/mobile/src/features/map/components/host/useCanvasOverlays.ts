import { useDeferredValue, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore } from '../../map.store';
import type { MapTabId } from '../../map-config.types';
import type { MapOverlay } from '../../overlay.types';
import type { MapLensName } from '../../sheet-stack.constants';
import { applyMapLens, overlayLensOf, type PublishedLens } from '../../sheet-lens.rules';
import type { LayerVisibilityInputs } from '../../layers.rules';

interface UseCanvasOverlaysInputs {
  lenses: ReadonlyMap<string, PublishedLens>;
  activeTab: MapTabId;
  presentationLens: MapLensName;
  layerState: LayerVisibilityInputs;
  collisionPeers: ReadonlySet<string>;
  selectedPlaceId: string | null;
  selectedPlace: MapOverlay | null;
}

export function useCanvasOverlays({
  lenses,
  activeTab,
  presentationLens,
  layerState,
  collisionPeers,
  selectedPlaceId,
  selectedPlace,
}: UseCanvasOverlaysInputs) {
  const stackIds = useMapStore(useShallow((s) => s.tasks[s.activeTab].stack.map((e) => e.id)));

  const overlayLens = useMemo(
    () => overlayLensOf(lenses.values(), activeTab, stackIds),
    [lenses, activeTab, stackIds],
  );
  /** WHY: the same object while nothing is dropped, so a settle redraws no marker. */
  const shownLens = useMemo(() => applyMapLens(overlayLens, presentationLens), [overlayLens, presentationLens]);

  /**
   * EVIDENCE: mounting the markers a pop re-shows took 1.2 s of a 1.8 s commit on a Note9 dev build, holding the
   * back key's sheet; deferred, the sheet commits first. One object, so layers, lens and selection agree.
   */
  const canvasOverlays = useDeferredValue(
    useMemo(
      () => ({
        layerState,
        collisionPeers,
        selectedPlaceId,
        selectedPlace,
        hiddenIds: overlayLens.hiddenIds,
        taskOverlays: shownLens.overlays,
        dimOthers: overlayLens.dimOthers,
      }),
      [layerState, collisionPeers, selectedPlaceId, selectedPlace, overlayLens, shownLens],
    ),
  );

  return { canvasOverlays, taskHeader: overlayLens.header };
}
