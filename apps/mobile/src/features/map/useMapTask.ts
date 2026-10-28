import { useCallback, useMemo } from 'react';
import { toLinkOpening, topEntry } from './map-task.rules';
import { useMapStore } from './map.store';
import { openSheet } from './map.service';
import type { LayerLens, MapTabId } from './map-config.types';
import type { EntrySource } from '@/platform/analytics.rules';
import type { MapSheetRequest, PageOrigin } from './sheet-stack.types';
import { useMapRegistry } from './useMapRegistry';

const NO_LAYERS: LayerLens = {};

export function useMapTask(tab: MapTabId) {
  const task = useMapStore((s) => s.tasks[tab]);
  const dispatchTask = useMapStore((s) => s.dispatchTask);
  const { views } = useMapRegistry();

  const push = useCallback(
    (request: MapSheetRequest, layers: LayerLens = NO_LAYERS, origin?: PageOrigin) =>
      openSheet(tab, 'push', request, layers, views, origin),
    [tab, views],
  );

  const select = useCallback(
    (request: MapSheetRequest, layers: LayerLens = NO_LAYERS) => openSheet(tab, 'select', request, layers, views),
    [tab, views],
  );

  const open = useCallback(
    (request: MapSheetRequest, layers: LayerLens = NO_LAYERS) => openSheet(tab, 'open', request, layers, views),
    [tab, views],
  );

  const openLink = useCallback(
    (request: MapSheetRequest, source: EntrySource | undefined, layers: LayerLens = NO_LAYERS, origin?: PageOrigin) =>
      openSheet(tab, toLinkOpening(source, origin), request, layers, views, origin),
    [tab, views],
  );

  const pop = useCallback(() => dispatchTask(tab, { type: 'pop' }), [dispatchTask, tab]);
  const popToRoot = useCallback(() => dispatchTask(tab, { type: 'popToRoot' }), [dispatchTask, tab]);
  const dismiss = useCallback((id: number) => dispatchTask(tab, { type: 'dismiss', id }), [dispatchTask, tab]);

  const top = useMemo(() => topEntry(task), [task]);

  return { task, top, push, select, open, openLink, pop, popToRoot, dismiss };
}
