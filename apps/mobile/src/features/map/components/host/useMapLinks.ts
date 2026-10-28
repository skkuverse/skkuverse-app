/**
 * WHY: each link is held until what it needs has arrived, then opened or abandoned after
 * `PLACE_LINK_ABANDON_MS`. A place a page opened is pushed over what is open and replaces nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logMapPlaceNotFound } from '@/platform/analytics';
import type { ChipSource } from '@/platform/analytics.types';
import { devLog } from '@/platform/dev-log';
import { buildingDetailQueryOptions } from '../../building/building.client';
import { toPlaceCamera } from '../../camera-targets.rules';
import { chipOfTap } from '../../chips.rules';
import { CAMERA_LEAD_MS, PLACE_LINK_ABANDON_MS, PRESENT_AFTER_MS } from '../../map-links.constants';
import { decideLinkArrival, fedKindOf, fedPlaceLayers, toPlaceRequest, toSheetRequest, topmostEntry } from '../../map-task.rules';
import { closeSheet, pendingMapChipLink, pendingMapPlaceLink } from '../../map.service';
import { useMapStore } from '../../map.store';
import type { FedPlaceKind } from '../../overlay.types';
import type { LayerLens } from '../../map-config.types';
import type { MapSheetRequest, MapSheetRequestOf, PageOrigin, PlaceSource } from '../../sheet-stack.types';
import { useMapCommands } from '../../useMapCommands';
import { useMapRegistry } from '../../useMapRegistry';
import { useMapTask } from '../../useMapTask';
import { useMapWorld } from '../../useMapWorld';
import { useSearchedBuilding } from '../../useSearchedBuilding';

export function useMapLinks(): void {
  const { mapConfig, tabScope, eventPlaces, fedPlaces } = useMapWorld();
  const { views } = useMapRegistry();
  const { moveTo, runChip } = useMapCommands();
  const { select, push } = useMapTask('map');
  const queryClient = useQueryClient();

  const openPlace = useCallback(
    (request: MapSheetRequest, layers?: LayerLens, origin?: PageOrigin) =>
      origin ? push(request, layers, origin) : select(request, layers),
    [push, select],
  );

  const [pendingPlace, setPendingPlace] = useState<{ placeId: string; source: PlaceSource; origin?: PageOrigin } | null>(
    null,
  );
  const [pendingBuilding, setPendingBuilding] = useState<{
    request: MapSheetRequestOf<'skku_building'>;
    origin?: PageOrigin;
  } | null>(null);
  /** WHY: held until the feed answers, so the sheet draws the stop's routes from its first frame. */
  const [pendingFed, setPendingFed] = useState<{
    request: MapSheetRequest;
    kind: FedPlaceKind;
    placeId: string;
    origin?: PageOrigin;
  } | null>(null);

  const prefetchBuilding = useCallback(
    (skkuId: number) => {
      void queryClient.prefetchQuery(buildingDetailQueryOptions(skkuId));
    },
    [queryClient],
  );

  // WHY: no root-layout consumer: `redirectSystemPath` already returned this tab, so it is mounted, and only it
  // can resolve a placeId.
  useEffect(() => {
    const tryConsume = () => {
      const p = pendingMapPlaceLink.consume('map');
      if (!p) return;
      const { origin } = p;
      if (origin) {
        devLog('map.placeFromPage', { placeId: p.placeId });
      } else if (decideLinkArrival(p.source) === 'startOver') {
        // WHY: a station linked over an open stop would stack on it, and a page's return focus would re-raise the sheet.
        closeSheet('map', { kind: 'linkArrival' });
      } else {
        // WHY: a place asked for from a place sheet replaces that place, and the
        // chip under it stays; the return focus must not re-raise the old card.
        const open = topmostEntry(useMapStore.getState().tasks.map, 'event');
        if (open) closeSheet('map', { kind: 'linkArrival', id: open.id });
      }
      const request = toSheetRequest(p, views);
      const fed = fedKindOf(p.kind);
      if (!request) return;
      // WHY: a building needs nothing but its id, so it does not wait on the event markers.
      if (request.kind === 'skku_building') {
        prefetchBuilding(Number(request.placeId));
        setPendingBuilding({ request, origin });
      } else if (request.kind === 'event') {
        setPendingPlace({ placeId: request.placeId, source: request.source, origin });
      } else if (fed && views[fed]?.layersFromFeed) {
        setPendingFed({ request, kind: fed, placeId: p.placeId, origin });
      } else {
        // WHY: a station's sheet frames itself from the page it fetches, so nothing waits here.
        openPlace(request, undefined, origin);
      }
    };
    tryConsume(); // WHY: a cold-start link was set before this tree existed
    return pendingMapPlaceLink.subscribe(tryConsume);
  }, [openPlace, prefetchBuilding, views]);

  const [pendingChip, setPendingChip] = useState<{ chipId: string; source: ChipSource } | null>(null);
  useEffect(() => {
    const take = () => {
      const link = pendingMapChipLink.consume();
      if (link) setPendingChip(link);
    };
    take(); // WHY: a cold-start link was set before this tree existed
    return pendingMapChipLink.subscribe(take);
  }, []);

  // WHY: the host runs a chip in the tab in front, and a warm link is stashed before navigating to this tab.
  const activeTab = useMapStore((s) => s.activeTab);
  useEffect(() => {
    if (!pendingChip) return;
    if (!mapConfig || activeTab !== 'map') {
      // WHY: abandoned like a place link, so a late chip never yanks the camera after the user moved on.
      const abandon = setTimeout(() => {
        devLog('map.chipLinkAbandoned', { chipId: pendingChip.chipId });
        setPendingChip(null);
      }, PLACE_LINK_ABANDON_MS);
      return () => clearTimeout(abandon);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the link consumed once the config can name the chip
    setPendingChip(null);
    // WHY: an id this config does not serve runs nothing, and neither does a `layers` chip under the native shell.
    const chip = chipOfTap(tabScope, 'map', mapConfig.chips, pendingChip.chipId);
    if (!chip) {
      devLog('map.chipLinkNotFound', { chipId: pendingChip.chipId });
      return;
    }
    runChip(chip, pendingChip.source);
  }, [pendingChip, mapConfig, activeTab, tabScope, runChip]);

  const pendingFeed = pendingFed ? fedPlaces[pendingFed.kind] : undefined;
  useEffect(() => {
    if (!pendingFed) return;
    const layers = fedPlaceLayers(pendingFeed, pendingFed.placeId);
    if (layers === null) {
      // WHY: abandoned like a place link, so a late sheet never yanks the camera after the user moved on.
      const abandon = setTimeout(() => {
        devLog('map.fedLinkAbandoned', { kind: pendingFed.kind, placeId: pendingFed.placeId });
        setPendingFed(null);
      }, PLACE_LINK_ABANDON_MS);
      return () => clearTimeout(abandon);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the link consumed once the feed has served the places
    setPendingFed(null);
    openPlace(pendingFed.request, layers, pendingFed.origin);
  }, [pendingFed, pendingFeed, openPlace]);

  useSearchedBuilding('map');

  // WHY: a cold-start link routinely beats the config request.
  useEffect(() => {
    if (!pendingBuilding || !mapConfig) return;
    const timer = setTimeout(() => {
      openPlace(pendingBuilding.request, undefined, pendingBuilding.origin);
      // WHY: cleared here, not before the timer: `pendingBuilding` is a dependency, so clearing it first re-runs the
      // effect, whose cleanup would clear the timeout that opens the sheet.
      setPendingBuilding(null);
    }, PRESENT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pendingBuilding, mapConfig, openPlace]);

  useEffect(() => {
    if (!pendingPlace) return;

    // WHY: abandon rather than fire late; offline, `settled` can take minutes, and the camera would yank then.
    const abandon = setTimeout(() => setPendingPlace(null), PLACE_LINK_ABANDON_MS);
    if (!eventPlaces.settled) return () => clearTimeout(abandon);
    clearTimeout(abandon);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the link consumed once the async marker fetch settles; the camera and sheet it drives are native
    setPendingPlace(null);
    const place = eventPlaces.byId.get(pendingPlace.placeId);
    // WHY: logged, since nothing on screen says why a stale or mistyped id opened no sheet.
    if (!place) {
      devLog('campus.placeNotFound', { placeId: pendingPlace.placeId });
      logMapPlaceNotFound({ placeId: pendingPlace.placeId });
      return;
    }

    // WHY: the camera leads and the sheet opens PRESENT_AFTER_MS later, the same wait
    // as a searched building's. The campus selection stays, as it does for that one.
    setTimeout(() => moveTo(toPlaceCamera(mapConfig, place), { request: 'sheet' }), CAMERA_LEAD_MS);
    const request = toPlaceRequest(place, pendingPlace.source);
    const { origin } = pendingPlace;
    setTimeout(() => openPlace(request, undefined, origin), PRESENT_AFTER_MS);
  }, [pendingPlace, eventPlaces.settled, eventPlaces.byId, moveTo, mapConfig, openPlace]);
}
