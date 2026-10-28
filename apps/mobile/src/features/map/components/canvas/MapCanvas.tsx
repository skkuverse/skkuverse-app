/**
 * EVIDENCE: memoised apart from `MapHost`, since re-rendering ~270 markers for every sheet change took
 * 330-390 ms of JS per tab switch in a Debug build. WHY: every prop stays stable unless its data changes,
 * so a change that reaches the map re-renders only the layers it concerns.
 */

import { Profiler, memo, type ProfilerOnRenderCallback, type Ref } from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import type { Camera, LocationTrackingMode, NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import { devLog } from '@/platform/dev-log';
import type { LogoMargin, MapPadding } from '../../camera-move.rules';
import type { MapConfig } from '../../map-config.types';
import type { MapOverlay, MarkerTap } from '../../overlay.types';
import type { TaskOverlay } from '../../sheet-stack.types';
import { MapView } from './MapView';
import { MapOverlayLayer } from './MapOverlayLayer';
import { MapTaskOverlays } from './MapTaskOverlays';
import type { StopMarkerShape } from './task-marker.rules';
import { isLayerVisible, isLayerDimmed, type LayerVisibilityInputs } from '../../layers.rules';
import type { Campus } from '@skkuverse/shared';

interface MapCanvasProps {
  mapRef: Ref<NaverMapViewRef>;
  mapConfig: MapConfig;
  selectedCampus: Campus;
  mapPadding: MapPadding | undefined;
  logoMargin: LogoMargin | undefined;
  camera: Camera | undefined;
  scrollLocked: boolean;
  hiddenFromScreenReader: boolean | undefined;
  touchHandlers: {
    onTouchStart: (e: GestureResponderEvent) => void;
    onTouchMove: (e: GestureResponderEvent) => void;
    onTouchEnd: (e: GestureResponderEvent) => void;
    onTouchCancel: (e: GestureResponderEvent) => void;
  };
  onOptionChanged: (params: { locationTrackingMode: LocationTrackingMode }) => void;
  onCameraChanged: (params: Camera) => void;
  onCameraIdle: (params: Camera) => void;
  layerState: LayerVisibilityInputs;
  now: number;
  collisionPeers: ReadonlySet<string>;
  selectedPlaceId: string | null;
  selectedPlace: MapOverlay | null;
  hiddenIds: ReadonlySet<string>;
  taskOverlays: readonly TaskOverlay[];
  stopShape: StopMarkerShape;
  dimOthers: boolean;
  buildingCounts: ReadonlyMap<string, number>;
  onMarkerTap: (tap: MarkerTap) => void;
}

const logRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
  devLog('map.canvasRender', { phase, ms: Math.round(actualDuration) });
};

export const MapCanvas = memo(function MapCanvas({
  mapRef,
  mapConfig,
  selectedCampus,
  mapPadding,
  logoMargin,
  camera,
  scrollLocked,
  hiddenFromScreenReader,
  touchHandlers,
  onOptionChanged,
  onCameraChanged,
  onCameraIdle,
  layerState,
  now,
  collisionPeers,
  selectedPlaceId,
  selectedPlace,
  hiddenIds,
  taskOverlays,
  stopShape,
  dimOthers,
  buildingCounts,
  onMarkerTap,
}: MapCanvasProps) {
  return (
    <Profiler id="MapCanvas" onRender={logRender}>
      <MapView
        ref={mapRef}
        mapConfig={mapConfig}
        selectedCampus={selectedCampus}
        style={StyleSheet.absoluteFill}
        onOptionChanged={onOptionChanged}
        onCameraChanged={onCameraChanged}
        onCameraIdle={onCameraIdle}
        camera={camera}
        mapPadding={mapPadding}
        logoMargin={logoMargin}
        scrollLocked={scrollLocked}
        hiddenFromScreenReader={hiddenFromScreenReader}
        {...touchHandlers}
      >
        {mapConfig.layers.map((layer) => {
          // WHY: resolved in `isLayerVisible` alone and never written to the store; the place the sheet is open on
          // still draws as that single pin (`onlyId`) when its layer is off.
          if (!isLayerVisible(layer, layerState, now)) {
            if (selectedPlace?.layerId !== layer.id) return null;
            return (
              <MapOverlayLayer
                key={layer.id}
                layer={layer}
                collisionPeers={collisionPeers}
                selectedPlaceId={selectedPlaceId}
                onMarkerTap={onMarkerTap}
                onlyId={selectedPlace.id}
              />
            );
          }

          return (
            <MapOverlayLayer
              key={layer.id}
              layer={layer}
              collisionPeers={collisionPeers}
              selectedPlaceId={selectedPlaceId}
              onMarkerTap={onMarkerTap}
              hiddenIds={hiddenIds}
              dimmed={isLayerDimmed(layer, layerState, dimOthers)}
              buildingCounts={buildingCounts}
            />
          );
        })}
        <MapTaskOverlays overlays={taskOverlays} stopShape={stopShape} onMarkerTap={onMarkerTap} />
      </MapView>
    </Profiler>
  );
});
