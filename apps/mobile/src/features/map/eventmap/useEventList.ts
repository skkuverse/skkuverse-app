/** WHY: mounted once per chip entry, so a re-tap of the chip starts its filters over. */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { SheetRef } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/platform/analytics';
import {
  defaultFacetSelection,
  filterByFacets,
  sortForList,
  sortPlaces,
  type FacetSelection,
} from './event-list.rules';
import { toPlaceRequest, topmostEntry } from '../map-task.rules';
import { toPlaceCamera } from '../camera-targets.rules';
import { useMapStore } from '../map.store';
import type { MapTabId } from '../map-config.types';
import type { MapOverlay } from '../overlay.types';
import type { MapOverlayLens, MapSheetEntryOf } from '../sheet-stack.types';
import { useMapCommands } from '../useMapCommands';
import { useMapLayout } from '../useMapLayout';
import { useMapWorld } from '../useMapWorld';
import { useMapTask } from '../useMapTask';
import { useSheetLens } from '../useSheetLens';
import { useEventListRows } from './useEventListRows';

const NO_IDS: ReadonlySet<string> = new Set();

export function useEventList(tab: MapTabId, entry: MapSheetEntryOf<'chip'>) {
  const { mapConfig, now } = useMapWorld();
  const { moveTo } = useMapCommands();
  const layout = useMapLayout();
  const { select } = useMapTask(tab);
  const selectedPlaceId = useMapStore((s) => topmostEntry(s.tasks[tab], 'event')?.request.placeId ?? null);

  const { chip, layerPlaces, showList } = useEventListRows(entry);
  const list = chip?.list ?? null;

  /**
   * WHY: until the user picks, the default is re-read on the clock, so a list left open across the day's
   * cut-over moves to the new day.
   */
  const [facetPick, setFacetPick] = useState<FacetSelection | null>(null);
  const facetSelection = useMemo<FacetSelection>(() => {
    if (!list) return {};
    return facetPick ?? defaultFacetSelection(list, now);
  }, [list, facetPick, now]);

  const facetSheetRef = useRef<SheetRef>(null);
  const [openFacetId, setOpenFacetId] = useState<string | null>(null);
  const openFacet = list?.facets.find((f) => f.id === openFacetId) ?? null;
  const onOpenFacet = useCallback((facetId: string) => {
    setOpenFacetId(facetId);
    facetSheetRef.current?.present?.();
  }, []);

  const onSelectFacet = useCallback(
    (facetId: string, held: readonly string[]) => {
      setFacetPick({ ...facetSelection, [facetId]: held });
      logCampusContentSelect({
        content_type: 'eventmap_list_facet_pick',
        item_id: `${facetId}:${held.length > 0 ? held.join('+') : 'all'}`,
      });
      if (list?.facets.find((f) => f.id === facetId)?.select === 'required') {
        facetSheetRef.current?.dismiss?.();
      }
    },
    [facetSelection, list],
  );

  const listedPlaces = useMemo(
    () =>
      list
        ? sortForList(filterByFacets(layerPlaces, list, facetSelection), list, facetSelection)
        : sortPlaces(layerPlaces),
    [layerPlaces, list, facetSelection],
  );

  /** WHY: filtered-out places leave the map too, so the pins and rows agree; the open place is never taken out. */
  const filteredOutIds = useMemo<ReadonlySet<string>>(() => {
    if (!list) return NO_IDS;
    const kept = new Set(filterByFacets(layerPlaces, list, facetSelection));
    return new Set(
      layerPlaces.filter((p) => !kept.has(p) && p.id !== selectedPlaceId).map((p) => p.id),
    );
  }, [layerPlaces, list, facetSelection, selectedPlaceId]);

  const lens = useMemo<MapOverlayLens | null>(
    () => (filteredOutIds.size > 0 ? { hiddenIds: filteredOutIds } : null),
    [filteredOutIds],
  );
  useSheetLens(tab, entry.id, lens);

  // WHY: a row was chosen off a list, so unlike a pin tap it also moves the camera.
  const onSelectPlace = useCallback(
    (place: MapOverlay) => {
      moveTo(toPlaceCamera(mapConfig, place), { request: 'sheet' });
      select(toPlaceRequest(place, 'list'));
    },
    [moveTo, mapConfig, select],
  );

  return {
    showList,
    listedPlaces,
    list,
    facetSelection,
    openFacet,
    facetSheetRef,
    onOpenFacet,
    onSelectFacet,
    onSelectPlace,
    now,
    bottomPadding: layout.sheetContentBottom,
    bottomGap: layout.modalCardBottomGap,
  };
}
