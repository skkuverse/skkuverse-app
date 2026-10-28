import { useCallback, useMemo } from 'react';
import type { Campus } from '@skkuverse/shared';
import { isGateOpen } from '@/platform/ota';
import { appChips, withAppChips } from '../../app-chips.rules';
import { chipMark, chipsFor } from '../../chips.rules';
import { activeChip as activeChipOf } from '../../map-task.rules';
import { clearChip } from '../../map.service';
import type { MapChip, MapConfig, MapTabId } from '../../map-config.types';
import type { MapTaskState } from '../../sheet-stack.types';
import type { TabScope } from '../../layers.rules';
import { useAppLanguage } from '../../useAppLanguage';

interface UseMapChipsInputs {
  tabScope: TabScope;
  mapConfig: MapConfig | null;
  activeTab: MapTabId;
  mapTask: MapTaskState;
  selectedCampus: Campus;
}

export function useMapChips({ tabScope, mapConfig, activeTab, mapTask, selectedCampus }: UseMapChipsInputs) {
  /** WHY: the map tab is the one tab a chip is ever on (ADR 0022 d1); the transit row never shows a chip as on. */
  const activeChip = useMemo(() => (activeTab === 'map' ? activeChipOf(mapTask) : null), [activeTab, mapTask]);

  const lang = useAppLanguage();

  const servedChips = useMemo(
    () =>
      withAppChips(mapConfig?.chips ?? [], appChips({ lang, campus: selectedCampus, directionsEnabled: isGateOpen('directionsChips') })),
    [mapConfig, lang, selectedCampus],
  );

  const chips = useMemo(() => chipsFor(tabScope, activeTab, servedChips), [tabScope, activeTab, servedChips]);

  const mapChipRow = chipsFor(tabScope, 'map', servedChips).length > 0;

  const transitChipRow = chipsFor(tabScope, 'transit', servedChips).length > 0;

  /** WHY: looked up against the served chips, so a chip that left the config resolves to null and the strip goes. */
  const narrowedChip = useMemo(
    () => (mapConfig && activeChip
      ? mapConfig.chips.find((c) => c.id === activeChip.request.chipId) ?? null
      : null),
    [mapConfig, activeChip],
  );

  const chipMarkOf = useMemo(
    () => (tabScope === 'byTab' ? (chip: MapChip) => chipMark(chip, activeTab) : undefined),
    [tabScope, activeTab],
  );

  const handleChipClear = useCallback(() => clearChip(tabScope), [tabScope]);

  return { chips, mapChipRow, transitChipRow, narrowedChip, chipMarkOf, handleChipClear };
}
