/** WHY: frames once per entry and as a `'sheet'` request, so the settle never changes the campus (ADR 0022 d5). */

import { useEffect, useRef } from 'react';
import { toBuildingCamera } from '../camera-targets.rules';
import type { MapSheetEntryOf } from '../sheet-stack.types';
import { useMapCommands } from '../useMapCommands';
import { useMapLayout } from '../useMapLayout';
import { useMapWorld } from '../useMapWorld';
import { useBuildingDetail } from './useBuildingDetail';

export function useBuildingFrame(entry: MapSheetEntryOf<'skku_building'>) {
  const { mapConfig } = useMapWorld();
  const { moveTo } = useMapCommands();
  const layout = useMapLayout();
  const { data } = useBuildingDetail(Number(entry.request.placeId));
  const { visibleMapReady } = layout;
  const framedEntry = useRef<number | null>(null);
  useEffect(() => {
    const building = data?.building;
    if (!visibleMapReady || framedEntry.current === entry.id || !building || !mapConfig) return;
    framedEntry.current = entry.id;
    const camera = toBuildingCamera(building, entry.request.source, mapConfig);
    if (camera) moveTo(camera, { request: 'sheet' });
  }, [visibleMapReady, entry.id, entry.request.source, data, mapConfig, moveTo]);
}
