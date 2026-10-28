import { useCallback, useMemo, useRef, useState } from 'react';
import type { MapTabId } from '../../map-config.types';
import type { FedPlaceKind, MapPlace } from '../../overlay.types';
import type { MapOverlayLens } from '../../sheet-stack.types';
import type { PublishedLens } from '../../sheet-lens.rules';
import type { RootSheet } from '../../sheet-detents.rules';
import type { MapSheetViewTable } from '../../sheet-views.types';
import type { FedPlaces, MapRegistry, MapSheetActions } from '../../map-host.types';

export function useHostRegistries(views: Partial<MapSheetViewTable>) {
  const [rootSheets, setRootSheets] = useState<Partial<Record<MapTabId, RootSheet>>>({});

  const publishRootSheet = useCallback((forTab: MapTabId, root: RootSheet) => {
    setRootSheets((prev) => (prev[forTab] === root ? prev : { ...prev, [forTab]: root }));
  }, []);

  const [coveredTabs, setCoveredTabs] = useState<Partial<Record<MapTabId, boolean>>>({});

  const publishCoversTabBar = useCallback((forTab: MapTabId, covers: boolean) => {
    setCoveredTabs((prev) => (prev[forTab] === covers ? prev : { ...prev, [forTab]: covers }));
  }, []);

  /** WHY: a ref, not state: nothing renders from it, and lowering a sheet should not re-render the host. */
  const sheetActions = useRef<Partial<Record<MapTabId, MapSheetActions>>>({});

  /** WHY: a chip tapped on another tab before the map tab ever opened; carried out when that stack registers. */
  const pendingReveal = useRef(new Set<MapTabId>());

  const registerSheetActions = useCallback((forTab: MapTabId, actions: MapSheetActions | null) => {
    if (!actions) {
      delete sheetActions.current[forTab];
      return;
    }
    sheetActions.current[forTab] = actions;
    if (pendingReveal.current.delete(forTab)) actions.lowerToReveal();
  }, []);

  const lowerToReveal = useCallback((forTab: MapTabId) => {
    const actions = sheetActions.current[forTab];
    if (actions) actions.lowerToReveal();
    else pendingReveal.current.add(forTab);
  }, []);

  const [fedPlaces, setFedPlaces] = useState<FedPlaces>({});

  /**
   * WHY: only the focused tab's stack applies (ADR 0022); an entry's lens outlives its view while the entry is on
   * the stack, so a line's pins stay under a stop pushed over it.
   */
  const [lenses, setLenses] = useState<ReadonlyMap<string, PublishedLens>>(new Map());

  const publishLens = useCallback((tab: MapTabId, entryId: number, lens: MapOverlayLens | null) => {
    setLenses((prev) => {
      const key = `${tab}:${entryId}`;
      if (!lens && !prev.has(key)) return prev;
      const next = new Map(prev);
      if (lens) next.set(key, { tab, entryId, lens });
      else next.delete(key);
      return next;
    });
  }, []);

  const publishPlaces = useCallback((kind: FedPlaceKind, served: readonly MapPlace[] | null) => {
    setFedPlaces((prev) => {
      if (!served && !prev[kind]) return prev;
      const next = { ...prev };
      if (served) next[kind] = new Map(served.map((p) => [p.id, p]));
      else delete next[kind];
      return next;
    });
  }, []);

  const registry = useMemo<MapRegistry>(
    () => ({
      views,
      publishRootSheet,
      publishCoversTabBar,
      registerSheetActions,
      publishLens,
      publishPlaces,
    }),
    [views, publishRootSheet, publishCoversTabBar, registerSheetActions, publishLens, publishPlaces],
  );

  return { registry, rootSheets, coveredTabs, lowerToReveal, fedPlaces, lenses };
}
