import { useCallback } from 'react';
import { Sheet, SHEET_HANDOFF_RISE, type SheetPosition } from '@skkuverse/sds';
import { logConnectionTap } from '@/platform/analytics';
import { BuildingDetailContent } from './components/BuildingDetailContent';
import { buildingDetailSourceOf } from '../entry-source.rules';
import type { MapSheetCardProps } from '../sheet-views.types';
import { useMapTask } from '../useMapTask';
import { useBuildingFrame } from './useBuildingFrame';

/**
 * WHY: a building's detail is a destination, so it arrives at `large`, and a `large` sheet attaches as an
 * opaque sheet; `surface="glass"` keeps its family, so a lower detent would give the card back.
 */
const POSITION: SheetPosition = { kind: 'stuck', detent: 'large' };

export function BuildingDetailSheet({ tab, entry, sheetRef, bottomGap, onDismiss }: MapSheetCardProps<'skku_building'>) {
  const { select } = useMapTask(tab);
  const { placeId, highlightSpaceCd, source } = entry.request;
  const skkuId = Number(placeId);
  useBuildingFrame(entry);

  const handleConnectionTap = useCallback(
    (targetSkkuId: number) => {
      logConnectionTap(skkuId, targetSkkuId);
      select({ kind: 'skku_building', placeId: String(targetSkkuId), highlightSpaceCd: null, source: 'building_sheet' });
    },
    [select, skkuId],
  );

  // WHY: `dismiss` is optional on a SheetRef for an inline sheet; this one is always a modal.
  const dismiss = useCallback(() => sheetRef.current?.dismiss?.(), [sheetRef]);

  return (
    <Sheet
      ref={sheetRef}
      position={POSITION}
      surface="glass"
      bottomGap={bottomGap}
      // WHY: the campus sheet has already closed before this rises (`sheet-handoff.rules.ts`), so it rises on a short timing.
      animationConfigs={SHEET_HANDOFF_RISE}
      onDismiss={onDismiss}
    >
      <BuildingDetailContent
        skkuId={skkuId}
        highlightSpaceCd={highlightSpaceCd ?? undefined}
        source={buildingDetailSourceOf(source)}
        onConnectionTap={handleConnectionTap}
        onClose={dismiss}
        onNavigateAway={dismiss}
      />
    </Sheet>
  );
}
