/** WHY: split by how often each part changes, each with its own context, so a reader re-renders only for its part. */

import type { SharedValue } from 'react-native-reanimated';
import type { ChipSource } from '@/platform/analytics.types';
import type { LatLng } from '@skkuverse/shared';
import type { CameraRequestKind } from './camera-request.rules';
import type { LayerVisibilityInputs, TabScope } from './layers.rules';
import type { MapChip, MapChipCamera, MapConfig, MapTabId } from './map-config.types';
import type { FedPlaceKind, MapOverlay, MapPlace } from './overlay.types';
import type { DetentMeasure, RootSheet } from './sheet-detents.rules';
import type { MapOverlayLens } from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';

export interface MapHostEventPlaces {
  endpoint: string | null;
  overlays: readonly MapOverlay[];
  byId: ReadonlyMap<string, MapOverlay>;
  /** WHY: the one value that tells "no event" from "not yet". */
  settled: boolean;
}

export type FedPlaces = Readonly<Partial<Record<FedPlaceKind, ReadonlyMap<string, MapPlace>>>>;

export interface MapSheetActions {
  lowerToReveal: () => void;
}

export interface MapWorld {
  mapConfig: MapConfig | null;
  tabScope: TabScope;
  layerState: LayerVisibilityInputs;
  now: number;
  eventPlaces: MapHostEventPlaces;
  fedPlaces: FedPlaces;
}

/** WHY: called from events and effects, never during render. */
export interface MapCommands {
  /** WHY: `request` names what asked, so the settle reads as that answer rather than drift (ADR 0008). */
  moveTo: (target: MapChipCamera, options: { request: CameraRequestKind | null }) => void;
  fitBounds: (points: readonly (LatLng | null)[], options: { request: CameraRequestKind | null }) => void;
  runChip: (chip: MapChip, source: ChipSource) => void;
  lowerToReveal: (tab: MapTabId) => void;
}

export interface MapLayout {
  containerHeight: number;
  controlsBottom: number;
  /** WHY: a sheet on the size table gets no gap here; SDS takes it off its stops itself. */
  floatInset: number;
  /** WHY: a view's frame effect waits for it, or it frames under a padding still 0 and stays wrong. */
  visibleMapReady: boolean;
  modalCardBottomGap: number;
  sheetContentBottom: number;
  detentMeasure: Readonly<Record<MapTabId, DetentMeasure>>;
  sheetTop: Readonly<Record<MapTabId, SharedValue<number>>>;
  sheetAnchor: Readonly<Record<MapTabId, SharedValue<number>>>;
  coveredTabs: Readonly<Partial<Record<MapTabId, boolean>>>;
}

export interface MapRegistry {
  views: Partial<MapSheetViewTable>;
  publishRootSheet: (tab: MapTabId, root: RootSheet) => void;
  publishCoversTabBar: (tab: MapTabId, covers: boolean) => void;
  /** WHY: held in a ref, so no re-render. */
  registerSheetActions: (tab: MapTabId, actions: MapSheetActions | null) => void;
  publishLens: (tab: MapTabId, entryId: number, lens: MapOverlayLens | null) => void;
  publishPlaces: (kind: FedPlaceKind, places: readonly MapPlace[] | null) => void;
}
