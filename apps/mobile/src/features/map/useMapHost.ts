import { useEffect, useMemo, useRef } from 'react';
import type { NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import { useT } from '@skkuverse/shared';
import type { SheetRef } from '@skkuverse/sds';
import { isGateOpen } from '@/platform/ota';
import { buildingCountsFor } from './components/canvas/number-circle.rules';
import { useCameraDriver } from './components/host/useCameraDriver';
import { useCanvasOverlays } from './components/host/useCanvasOverlays';
import { useCampusReconciliation } from './components/host/useCampusReconciliation';
import { useEventPlaces } from './components/host/useEventPlaces';
import { useHostLayout } from './components/host/useHostLayout';
import { useHostRegistries } from './components/host/useHostRegistries';
import { useLaunchFrame } from './components/host/useLaunchFrame';
import { useMapChips } from './components/host/useMapChips';
import { useMapLayers } from './components/host/useMapLayers';
import { useMapTaps } from './components/host/useMapTaps';
import { useLocationTracking } from './components/useLocationTracking';
import { useMapStore } from './map.store';
import type { MapTabId } from './map-config.types';
import type { MapSheetViewTable } from './sheet-views.types';
import { useThisWeekBuildingCounts } from './this-week/useThisWeekBuildingCounts';
import { useMapConfig } from './useMapConfig';
import type { MapCommands, MapWorld } from './map-host.types';
import type { TabScope } from './layers.rules';

interface UseMapHostInputs {
  sheetViews: Partial<MapSheetViewTable>;
  tabScope: TabScope;
  tab: MapTabId;
  visibleMapCamera: boolean;
  launchAtUser: boolean;
  campusSuggestions: boolean;
  toolbar: boolean;
}

export function useMapHost({
  sheetViews,
  tabScope,
  tab,
  visibleMapCamera,
  launchAtUser,
  campusSuggestions,
  toolbar,
}: UseMapHostInputs) {
  const mapRef = useRef<NaverMapViewRef>(null);
  const filterSheetRef = useRef<SheetRef>(null);

  const mapConfig = useMapConfig().data ?? null;

  const selectedCampus = useMapStore((s) => s.selectedCampus);
  const thisWeekCounts = useThisWeekBuildingCounts(selectedCampus);
  const overrides = useMapStore((s) => s.overrides);
  const activeTab = useMapStore((s) => s.activeTab);
  const activeTask = useMapStore((s) => s.tasks[s.activeTab]);
  const mapTask = useMapStore((s) => s.tasks.map);
  const suggestionsSilenced = useMapStore((s) => s.suggestionsSilenced);
  const setSelectedCampus = useMapStore((s) => s.setSelectedCampus);
  const silenceSuggestions = useMapStore((s) => s.silenceSuggestions);
  const dispatchTask = useMapStore((s) => s.dispatchTask);
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  // WHY: the shell alone writes the focused tab, so a tab switch and the task it reveals land in one render.
  useEffect(() => {
    setActiveTab(tab);
  }, [tab, setActiveTab]);

  const { layerState } = useMapLayers({ tabScope, mapConfig, activeTab, overrides });
  const { chips, mapChipRow, transitChipRow, narrowedChip, chipMarkOf, handleChipClear } = useMapChips({
    tabScope,
    mapConfig,
    activeTab,
    mapTask,
    selectedCampus,
  });
  const { registry, rootSheets, coveredTabs, lowerToReveal, fedPlaces, lenses } = useHostRegistries(sheetViews);
  const {
    layout,
    visibleMapKnown,
    handleRootLayout,
    modalCardBottomGap,
    handleSafeAreaChange,
    presentation,
    chrome,
    handleControlsLayout,
    mapPadding,
    logoMargin,
    fitSpace,
    locateStyle,
  } = useHostLayout({
    sheetViews,
    mapConfig,
    activeTab,
    activeTask,
    toolbar,
    visibleMapCamera,
    mapChipRow,
    transitChipRow,
    rootSheets,
    coveredTabs,
  });

  const { t, tpl } = useT();

  const {
    mode: trackingMode,
    scrollLocked,
    mapTouchHandlers,
    permissionGranted,
    requestPermission,
    handleOptionChanged,
    cycleMode,
    showUserLocation,
  } = useLocationTracking(mapRef);

  const {
    bearing: cameraBearing,
    cameraCommand,
    handleCameraChanged,
    stopShape,
    resetNorth,
    cameraTaken,
    touchHandlers,
    cameraDefaults,
    awaitingExplicitCameraResult,
    applyCameraRequest,
    moveTo,
    fitBounds,
  } = useCameraDriver({ mapRef, mapConfig, activeTab, dispatchTask, mapTouchHandlers, fitSpace });

  const {
    focusCampus,
    suppressNextCampusFocus,
    suggestion,
    handleCameraIdle,
    handleSuggestionAccept,
    handleSuggestionDismiss,
    handleLocatePress,
    handleCampusPick,
  } = useCampusReconciliation({
    campusSuggestions,
    mapConfig,
    selectedCampus,
    setSelectedCampus,
    silenceSuggestions,
    suggestionsSilenced,
    activeTab,
    activeTask,
    mapTask,
    dispatchTask,
    cameraDefaults,
    moveTo,
    awaitingExplicitCameraResult,
    applyCameraRequest,
    trackingMode,
    cycleMode,
  });

  useLaunchFrame({
    launchAtUser,
    visibleMapKnown,
    mapConfig,
    fedPlaces,
    mapPadding,
    activeTab,
    activeTask,
    selectedCampus,
    setSelectedCampus,
    cameraTaken,
    suppressNextCampusFocusRef: suppressNextCampusFocus,
    moveTo,
    focusCampus,
    showUserLocation,
    applyCameraRequest,
  });

  const { eventPlaces, placesById, now, selectedPlaceId, selectedPlace, collisionPeers } = useEventPlaces({
    mapConfig,
    activeTask,
    layerState,
  });

  const { runChip, handleChipPress, handleMarkerTap } = useMapTaps({
    sheetViews,
    tabScope,
    mapConfig,
    activeTab,
    moveTo,
    lowerToReveal,
    placesById,
    fedPlaces,
  });

  const { canvasOverlays, taskHeader } = useCanvasOverlays({
    lenses,
    activeTab,
    presentationLens: presentation.lens,
    layerState,
    collisionPeers,
    selectedPlaceId,
    selectedPlace,
  });

  // WHY: one context per rate of change, so a sheet reading only commands is not re-rendered by a clock tick.
  const world = useMemo<MapWorld>(
    () => ({ mapConfig, tabScope, layerState, now, eventPlaces, fedPlaces }),
    [mapConfig, tabScope, layerState, now, eventPlaces, fedPlaces],
  );
  const commands = useMemo<MapCommands>(
    () => ({ moveTo, fitBounds, runChip, lowerToReveal }),
    [moveTo, fitBounds, runChip, lowerToReveal],
  );

  return {
    world,
    commands,
    layout,
    registry,
    mapRef,
    filterSheetRef,
    mapConfig,
    selectedCampus,
    layerState,
    now,
    canvasOverlays,
    stopShape,
    buildingCounts: buildingCountsFor(isGateOpen('buildingCounts'), thisWeekCounts),
    chrome,
    taskHeader,
    onMarkerTap: handleMarkerTap,
    handleOptionChanged,
    handleCameraChanged,
    handleCameraIdle,
    cameraCommand,
    scrollLocked,
    mapTouchHandlers: touchHandlers,
    handleRootLayout,
    handleControlsLayout,
    handleSafeAreaChange,
    mapPadding,
    logoMargin,
    modalCardBottomGap,
    chips,
    narrowedChip,
    handleChipPress,
    chipMarkOf,
    handleChipClear,
    trackingMode,
    cameraBearing,
    permissionGranted,
    requestPermission,
    resetNorth,
    suggestion,
    locateStyle,
    handleSuggestionAccept,
    handleSuggestionDismiss,
    handleLocatePress,
    handleCampusPick,
    t,
    tpl,
  };
}
