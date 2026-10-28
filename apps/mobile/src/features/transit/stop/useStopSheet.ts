import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMapCommands } from '@/features/map/useMapCommands';
import { useMapLayout } from '@/features/map/useMapLayout';
import { useMapWorld } from '@/features/map/useMapWorld';
import { useMapTask } from '@/features/map/useMapTask';
import { useSheetLens } from '@/features/map/useSheetLens';
import type { MapTabId } from '@/features/map/map-config.types';
import type { MapOverlayLens, MapSheetEntryOf } from '@/features/map/sheet-stack.types';
import type { MapSheetViewProps } from '@/features/map/sheet-views.types';
import { track } from '@/platform/analytics';
import { useNow } from '@/platform/clock';
import { lineEntryOf, toLineNeighbours, toStopSheetRows } from './stop.rules';
import { useServerClockOffset } from '../components/useServerClockOffset';
import { useTransitLoadError } from '../components/useTransitLoadError';
import { stopRouteLayers, toFocusedPlacePin, toStopCamera } from '../map-lens.rules';
import { isStopGone, stopArrivalsQueryOptions } from '../transit.client';
import { useBusConfig } from '../useBusConfig';
import { useBusStops } from '../useBusStops';

export type StopSheetStatus = 'loading' | 'ready' | 'gone' | 'error';

export function useStopSheet(
  tab: MapTabId,
  entry: MapSheetEntryOf<'bus_stop'>,
  sheet: MapSheetViewProps<'bus_stop'>['sheet'],
) {
  const { stopId, line } = entry.request;
  const { mapConfig } = useMapWorld();
  const { moveTo } = useMapCommands();
  const layout = useMapLayout();
  const { select } = useMapTask(tab);

  const { data: page, error, isLoading, dataUpdatedAt, refetch } = useQuery(stopArrivalsQueryOptions(stopId));
  const gone = isStopGone(error);
  const failed = !isLoading && !page && !gone && error !== null;
  const loadError = useTransitLoadError('bus_stop', stopId, failed, refetch);

  const clockOffsetMs = useServerClockOffset(page?.serverNowMs, dataUpdatedAt);
  const nowMs = useNow(1000);
  const rows = useMemo(() => (page ? toStopSheetRows(page, nowMs + clockOffsetMs) : []), [page, nowMs, clockOffsetMs]);

  // WHY: not before the host's content padding exists, or the stop does not land centred in the visible map.
  const { visibleMapReady } = layout;
  const framedEntry = useRef<number | null>(null);
  useEffect(() => {
    const coords = page?.stop.coords;
    if (!visibleMapReady || framedEntry.current === entry.id || !coords || !mapConfig) return;
    framedEntry.current = entry.id;
    moveTo(toStopCamera(coords, mapConfig.cameraDefaults.markerFocus), { request: 'sheet' });
  }, [visibleMapReady, entry.id, page, mapConfig, moveTo]);

  const lens = useMemo<MapOverlayLens | null>(() => {
    const stop = page?.stop;
    if (!stop) return null;
    const header = { title: stop.name };
    if (!stop.coords) return { header };
    const pin = toFocusedPlacePin({ id: stop.id, name: stop.name, coords: stop.coords });
    return { overlays: [pin], dimOthers: true, header };
  }, [page]);
  useSheetLens(tab, entry.id, lens);

  const { dismiss, dismissAction } = sheet;
  const onClose = useCallback(() => {
    track('item_action', { view: 'stop_sheet', item_id: stopId, action: dismissAction });
    dismiss();
  }, [dismiss, dismissAction, stopId]);

  // WHY: a step replaces this sheet in place with a new entry, which re-runs the zoom above.
  const { data: lineConfig } = useBusConfig(line?.groupId);
  const { data: stops } = useBusStops({ enabled: line !== undefined });
  const neighbours = useMemo(() => {
    if (!line || lineConfig?.screenType !== 'realtime') return null;
    return toLineNeighbours(lineConfig.screen.stations, line.stationIndex);
  }, [line, lineConfig]);
  const step = useCallback(
    (action: 'prev' | 'next') => {
      const neighbour = neighbours?.[action];
      if (!line || !neighbour?.stopId) return;
      track('item_action', { view: 'stop_sheet', item_id: stopId, action, target: neighbour.stopId });
      select(
        {
          kind: 'bus_stop',
          stopId: neighbour.stopId,
          source: 'line_sheet',
          line: { groupId: line.groupId, stationIndex: neighbour.index },
        },
        mapConfig ? stopRouteLayers(stops, neighbour.stopId, line.groupId, mapConfig.layers) : {},
      );
    },
    [line, neighbours, mapConfig, select, stopId, stops],
  );
  const onPrev = useCallback(() => step('prev'), [step]);
  const onNext = useCallback(() => step('next'), [step]);
  const lineEntry = line && page ? lineEntryOf(page, line.groupId) : null;

  const status: StopSheetStatus = gone ? 'gone' : page ? 'ready' : failed ? 'error' : 'loading';

  return {
    status,
    name: page?.stop.name ?? '',
    steps: line ? { onPrev: neighbours?.prev ? onPrev : undefined, onNext: neighbours?.next ? onNext : undefined } : null,
    lineEntry,
    rows,
    onClose,
    onRetry: loadError.onRetry,
    bottomPadding: layout.sheetContentBottom,
  };
}
