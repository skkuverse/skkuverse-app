import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { layerLensOf } from '../../map-task.rules';
import { useMapStore } from '../../map.store';
import type { MapConfig, MapTabId } from '../../map-config.types';
import { tabDefaultFor, type LayerVisibilityInputs, type TabScope } from '../../layers.rules';

interface UseMapLayersInputs {
  tabScope: TabScope;
  mapConfig: MapConfig | null;
  activeTab: MapTabId;
  overrides: Readonly<Record<string, boolean>>;
}

export function useMapLayers({ tabScope, mapConfig, activeTab, overrides }: UseMapLayersInputs) {
  // WHY: each camera settle records the top sheet's camera, a new task every
  // time. An entry's layers are fixed at push, so the lens is read off them
  // alone and keeps its identity, and the overlays do not re-render per settle.
  const stackLayers = useMapStore(useShallow((s) => s.tasks[s.activeTab].stack.map((e) => e.layers)));

  const stackLens = useMemo(() => layerLensOf(stackLayers), [stackLayers]);

  /** WHY: assembled once, so the render loop, the list, the collision peers and the filter sheet read one state. */
  // WHY: one record per tab, so switching back hands the map the record it had.
  const tabDefaults = useMemo(
    () => ({
      map: tabDefaultFor(tabScope, 'map', mapConfig?.layers ?? []),
      transit: tabDefaultFor(tabScope, 'transit', mapConfig?.layers ?? []),
    }),
    [tabScope, mapConfig],
  );

  const tabDefault = tabDefaults[activeTab];

  const layerState = useMemo<LayerVisibilityInputs>(
    () => ({ stackLens, userToggles: overrides, tabDefault }),
    [overrides, stackLens, tabDefault],
  );

  return { layerState };
}
