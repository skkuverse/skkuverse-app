import { useMemo } from 'react';
import { useLayerOverlays } from '../../useLayerOverlays';
import { topmostEntry } from '../../map-task.rules';
import type { MapConfig } from '../../map-config.types';
import type { MapOverlay } from '../../overlay.types';
import type { MapTaskState } from '../../sheet-stack.types';
import { isFestivalLayer, isLayerVisible, type LayerVisibilityInputs } from '../../layers.rules';
import type { MapHostEventPlaces } from '../../map-host.types';
import { useWindowEdgeClock } from '../canvas/useWindowEdgeClock';

interface UseEventPlacesInputs {
  mapConfig: MapConfig | null;
  activeTask: MapTaskState;
  layerState: LayerVisibilityInputs;
}

export function useEventPlaces({ mapConfig, activeTask, layerState }: UseEventPlacesInputs) {
  // WHY: the endpoint is read off the served festival layers, never hardcoded, so the pins, the list and the
  // peek sheet share one fetch and next year's festival changes the layers, not the URL.
  const eventEndpoint = useMemo(
    () => mapConfig?.layers.find(isFestivalLayer)?.endpoint ?? null,
    [mapConfig],
  );

  const eventQuery = useLayerOverlays(eventEndpoint ?? '', eventEndpoint !== null);

  const eventOverlays = useMemo(() => eventQuery.data ?? [], [eventQuery.data]);

  /**
   * WHY: built from every event overlay, so an open sheet survives a layer toggle and a link reaches a hidden
   * booth; every overlay, since a zone opens the same sheet a booth does.
   */
  const placesById = useMemo(() => {
    const map = new Map<string, MapOverlay>();
    for (const o of eventOverlays) {
      if (o.tap?.kind === 'event') map.set(o.tap.placeId, o);
    }
    return map;
  }, [eventOverlays]);

  /**
   * WHY: `isFetched`, not "has data": only it separates "no event today" from "not back yet"; a disabled query
   * never fetches, so it counts as settled.
   */
  const eventSettled = eventEndpoint === null || eventQuery.isFetched;

  const eventPlaces = useMemo<MapHostEventPlaces>(
    () => ({ endpoint: eventEndpoint, overlays: eventOverlays, byId: placesById, settled: eventSettled }),
    [eventEndpoint, eventOverlays, placesById, eventSettled],
  );

  /** WHY: memoised, because the clock hook keys on argument identity. */
  const layerWindows = useMemo(
    () =>
      (mapConfig?.layers ?? []).flatMap((l) =>
        l.defaultVisibleWhen?.kind === 'scheduled' ? l.defaultVisibleWhen.windows : [],
      ),
    [mapConfig],
  );

  /**
   * WHY: the layer windows are armed here and nowhere else, since a hidden layer is not mounted. Not shared with
   * `MapOverlayLayer`, whose own timer is cheaper than lifting its query up.
   */
  const now = useWindowEdgeClock(eventOverlays, layerWindows);

  /** WHY: the topmost event entry, not the top of the stack, so a building card over the place keeps its pin promoted. */
  const selectedPlaceId = useMemo(() => topmostEntry(activeTask, 'event')?.request.placeId ?? null, [activeTask]);

  const selectedPlace = selectedPlaceId ? (placesById.get(selectedPlaceId) ?? null) : null;

  /** WHY: building layers draw one building twice on purpose, which the ladder would read as a tie. */
  // WHY: keyed by its members, so an equal set keeps its identity and every memoised layer its props.
  const collisionPeerKey = useMemo(
    () =>
      (mapConfig?.layers ?? [])
        .filter((l) => isFestivalLayer(l) && isLayerVisible(l, layerState, now))
        .map((l) => l.id)
        .join('\n'),
    [mapConfig, layerState, now],
  );

  const collisionPeers = useMemo(
    () => new Set(collisionPeerKey === '' ? [] : collisionPeerKey.split('\n')),
    [collisionPeerKey],
  );

  return { eventPlaces, placesById, now, selectedPlaceId, selectedPlace, collisionPeers };
}
