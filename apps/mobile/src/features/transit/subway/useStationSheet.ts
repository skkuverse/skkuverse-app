import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useT } from '@skkuverse/shared';
import { useMapCommands } from '@/features/map/useMapCommands';
import { useMapLayout } from '@/features/map/useMapLayout';
import { useMapWorld } from '@/features/map/useMapWorld';
import { useSheetLens } from '@/features/map/useSheetLens';
import type { MapTabId } from '@/features/map/map-config.types';
import type { MapOverlayLens, MapSheetEntryOf } from '@/features/map/sheet-stack.types';
import type { MapSheetViewProps } from '@/features/map/sheet-views.types';
import { track } from '@/platform/analytics';
import { useSubway } from './useSubway';
import { toFocusedPlacePin, toStopCamera } from '../map-lens.rules';

export function useStationSheet(
  tab: MapTabId,
  entry: MapSheetEntryOf<'subway_station'>,
  sheet: MapSheetViewProps<'subway_station'>['sheet'],
) {
  const { stationId, line, source } = entry.request;
  const { mapConfig } = useMapWorld();
  const { moveTo } = useMapCommands();
  const layout = useMapLayout();
  const { tpl } = useT();
  const subway = useSubway(stationId, line, source);
  const { data } = subway;

  // WHY: frame the station once per entry, and only once the visible map's padding exists.
  const { visibleMapReady } = layout;
  const framedEntry = useRef<number | null>(null);
  useEffect(() => {
    const coords = data?.coords;
    if (!visibleMapReady || framedEntry.current === entry.id || !coords || !mapConfig) return;
    framedEntry.current = entry.id;
    moveTo(toStopCamera(coords, mapConfig.cameraDefaults.markerFocus), { request: 'sheet' });
  }, [visibleMapReady, entry.id, data, mapConfig, moveTo]);

  const lens = useMemo<MapOverlayLens | null>(() => {
    if (!data) return null;
    const header = { title: tpl('subway.stationTitle', data.stationName) };
    if (!data.coords) return { header };
    return {
      overlays: [toFocusedPlacePin({ id: data.stationId, name: data.stationName, coords: data.coords })],
      dimOthers: true,
      header,
    };
  }, [data, tpl]);
  useSheetLens(tab, entry.id, lens);

  const { dismiss, dismissAction } = sheet;
  const onClose = useCallback(() => {
    track('item_action', { view: 'station_sheet', item_id: stationId, action: dismissAction });
    dismiss();
  }, [dismiss, dismissAction, stationId]);

  return { ...subway, onClose, bottomPadding: layout.sheetContentBottom };
}
