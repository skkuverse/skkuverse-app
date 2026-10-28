/** WHY: only this body logs `building_sheet`; the native-tab card does not, so that shell's events stay unchanged. */

import { useCallback } from 'react';
import { logConnectionTap, track, useViewTracking } from '@/platform/analytics';
import { BuildingDetailContent } from './components/BuildingDetailContent';
import { buildingDetailSourceOf } from '../entry-source.rules';
import type { MapSheetTrackingProps, MapSheetViewProps } from '../sheet-views.types';
import { useMapTask } from '../useMapTask';
import { useBuildingFrame } from './useBuildingFrame';

export function BuildingSheetBody({ tab, entry, sheet }: MapSheetViewProps<'skku_building'>) {
  const { select } = useMapTask(tab);
  const { placeId, highlightSpaceCd, source } = entry.request;
  const skkuId = Number(placeId);

  useBuildingFrame(entry);

  const { dismiss, dismissAction } = sheet;
  const handleClose = useCallback(() => {
    track('item_action', { view: 'building_sheet', item_id: placeId, action: dismissAction });
    dismiss();
  }, [dismiss, dismissAction, placeId]);

  const handleConnectionTap = useCallback(
    (targetSkkuId: number) => {
      logConnectionTap(skkuId, targetSkkuId);
      select({ kind: 'skku_building', placeId: String(targetSkkuId), highlightSpaceCd: null, source: 'building_sheet' });
    },
    [select, skkuId],
  );

  return (
    <BuildingDetailContent
      skkuId={skkuId}
      highlightSpaceCd={highlightSpaceCd ?? undefined}
      source={buildingDetailSourceOf(source)}
      onConnectionTap={handleConnectionTap}
      onClose={handleClose}
    />
  );
}

export function BuildingSheetTracking({ entry }: MapSheetTrackingProps<'skku_building'>) {
  useViewTracking('building_sheet', entry.request.placeId, entry.request.source);
  return null;
}
