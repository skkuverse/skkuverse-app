
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import type { MapDetent } from '@/features/map/sheet-detents.constants';
import { pendingMapPlaceLink } from '@/features/map/map.service';
import { MAP_SHEET_PROFILES } from '@/features/map/sheet-stack.constants';
import { useMapLayout } from '@/features/map/useMapLayout';
import { useMapWorld } from '@/features/map/useMapWorld';
import { useMapTask } from '@/features/map/useMapTask';
import { useSearchedBuilding } from '@/features/map/useSearchedBuilding';
import { useSelectedCampus } from '@/features/map/useSelectedCampus';
import { track } from '@/platform/analytics';
import { toRouteLayers, toTransitPlaceRequest } from './map-lens.rules';
import { isRootPullDown, sectionsForCampus, withoutSectionTitles } from './transit.rules';
import { pendingTransitSheet } from './transit.service';
import { useTransitTab } from './useTransitTab';

export function useTransitMapTab({ reviewIcon }: { reviewIcon: ReactNode }) {
  const tab = useTransitTab({ reviewIcon });
  const { mapConfig, fedPlaces } = useMapWorld();
  const layout = useMapLayout();
  const { open, openLink } = useMapTask('transit');

  const selectedCampus = useSelectedCampus();
  const { data: served } = tab;
  const data = useMemo(
    () => served && { ...served, sections: withoutSectionTitles(sectionsForCampus(served.sections, selectedCampus)) },
    [served, selectedCampus],
  );

  /**
   * WHY: open once the config can name a line's route layer, so the lens is right from the first frame.
   * WHY: `open`, not `push`: the request came from outside the tab, so what was open is not its context.
   */
  useEffect(() => {
    if (!mapConfig) return;
    const drain = () => {
      const request = pendingTransitSheet.consume();
      if (!request) return;
      open(request, request.kind === 'line' ? toRouteLayers([request.groupId], mapConfig.layers) : {});
    };
    drain();
    return pendingTransitSheet.subscribe(drain);
  }, [mapConfig, open]);

  /**
   * WHY: `openLink` tells a page's open from a search result by source; a page that named itself as origin
   * is pushed over what is open, and its close returns to it. Opened once the stop feed has served the places.
   */
  const fedStops = fedPlaces.bus_stop;
  useEffect(() => {
    if (!fedStops) return;
    const drain = () => {
      const link = pendingMapPlaceLink.consume('transit');
      if (!link) return;
      const request = toTransitPlaceRequest(link);
      if (!request) return;
      const layers = request.kind === 'bus_stop' ? (fedStops.get(request.stopId)?.layers ?? {}) : {};
      openLink(request, link.source, layers, link.origin);
    };
    drain();
    return pendingMapPlaceLink.subscribe(drain);
  }, [fedStops, openLink]);

  useSearchedBuilding('transit');

  /**
   * WHY: logs a pull-down of the root once per focus; the previous level is kept across focuses,
   * since a tab switch re-reports the level the sheet remembers (`isRootPullDown`).
   */
  const { opening } = MAP_SHEET_PROFILES.transitRoot;
  const lastRootDetent = useRef<MapDetent>(opening);
  const pullDownLogged = useRef(false);
  useFocusEffect(
    useCallback(() => {
      pullDownLogged.current = false;
    }, []),
  );
  const onRootDetent = useCallback(
    (detent: MapDetent) => {
      const from = lastRootDetent.current;
      lastRootDetent.current = detent;
      if (pullDownLogged.current || !isRootPullDown(from, detent, opening)) return;
      pullDownLogged.current = true;
      track('item_action', { view: 'transit_root', item_id: 'root', action: 'collapse', target: detent });
    },
    [opening],
  );

  return { ...tab, data, onRootDetent, bottomPadding: layout.sheetContentBottom };
}
