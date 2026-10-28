import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import type { Camera, NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import { useSharedValue } from 'react-native-reanimated';
import type { LatLng } from '@skkuverse/shared';
import { devLog } from '@/platform/dev-log';
import { toPointCamera } from '../../camera-targets.rules';
import {
  reduceCameraRequest,
  type CameraRequest,
  type CameraRequestEvent,
  type CameraRequestKind,
} from '../../camera-request.rules';
import { boundsForPadding, distinctCommand, frameOf, moveCamera, type MapPadding } from '../../camera-move.rules';
import { DEFAULT_CAMERA_DEFAULTS } from '../../map.constants';
import type { MapChipCamera, MapConfig, MapTabId } from '../../map-config.types';
import type { MapTaskAction } from '../../map-task.rules';
import { stopMarkerShapeAt, type StopMarkerShape } from '../canvas/task-marker.rules';
import { useStableHandler } from './useStableHandler';

export type FitSpace = { band: MapPadding; padding: MapPadding; size: { width: number; height: number } };

interface UseCameraDriverInputs {
  mapRef: React.RefObject<NaverMapViewRef | null>;
  mapConfig: MapConfig | null;
  activeTab: MapTabId;
  dispatchTask: (tab: MapTabId, action: MapTaskAction) => void;
  mapTouchHandlers: Record<'onTouchStart' | 'onTouchMove' | 'onTouchEnd' | 'onTouchCancel', (e: GestureResponderEvent) => void>;
  fitSpace: React.RefObject<FitSpace | null>;
}

export function useCameraDriver({
  mapRef,
  mapConfig,
  activeTab,
  dispatchTask,
  mapTouchHandlers,
  fitSpace,
}: UseCameraDriverInputs) {
  /**
   * WHY: a shared value, not state: `onCameraChanged` fires every frame of a pan, and its one reader, the
   * compass rotation, is a UI-thread style anyway.
   */
  const bearing = useSharedValue(0);

  /**
   * WHY: a ref, not state, for the same per-frame reason as `bearing`. `moveCamera` reads the current attitude
   * from it to choose between the imperative method and the prop.
   */
  const lastCamera = useRef<Camera | null>(null);

  /**
   * QUIRK(naver-map): the bearing is reachable only through the `camera` prop, and the native side applies the
   * prop only when it differs by value, so every write goes through `distinctCommand`. A one-shot order, not
   * controlled state; undefined at first so `initialCamera` applies.
   */
  const [cameraCommand, setCameraCommand] = useState<Camera | undefined>(undefined);
  const commandCamera = useCallback((next: Camera) => {
    setCameraCommand((prev) => distinctCommand(prev, next));
  }, []);

  const handleCameraChanged = useCallback(
    (params: Camera) => {
      bearing.set(params.bearing ?? 0);
      lastCamera.current = params;
    },
    [bearing],
  );

  /** WHY: a getter, so a memoised callback cannot capture a stale attitude. */
  const getCurrentCamera = useCallback(() => lastCamera.current, []);

  /**
   * QUIRK(naver-map): a camera move already drops the SDK out of `Face` and `onOptionChanged` reports it, so
   * also setting the tracking mode would race the SDK's own transition.
   */
  const resetNorth = useCallback(() => {
    const cam = lastCamera.current;
    // WHY: nothing reported yet means no position to rotate around; a zero coordinate would land off West Africa.
    if (!cam) return;
    commandCamera({ ...cam, bearing: 0 });
  }, [commandCamera]);

  /** WHY: state that changes only when the zoom crosses the threshold, so a camera frame re-renders nothing. */
  const [stopShape, setStopShape] = useState<StopMarkerShape>('pin');
  const handleCameraChangedWithStops = useCallback(
    (params: Camera) => {
      handleCameraChanged(params);
      if (params.zoom !== undefined) setStopShape(stopMarkerShapeAt(params.zoom));
    },
    [handleCameraChanged],
  );

  /**
   * WHY: the launch frame waits for the fix and the stops; landing after the user has started reading the
   * map would yank it, so once anything else moves the camera it does not land.
   */
  const cameraTaken = useRef(false);

  const touchHandlers = useMemo(
    () => ({
      ...mapTouchHandlers,
      onTouchStart: (e: GestureResponderEvent) => {
        cameraTaken.current = true;
        mapTouchHandlers.onTouchStart(e);
      },
    }),
    [mapTouchHandlers],
  );

  /**
   * WHY: server-driven, so a chip's camera and a marker-tap camera agree on how close "close" is; structural
   * sharing keeps its identity across refetches.
   */
  const cameraDefaults = mapConfig?.cameraDefaults ?? DEFAULT_CAMERA_DEFAULTS;

  /**
   * QUIRK(naver-map): switching tracking on emits an idle at the old position before the camera moves, so the
   * request is timestamped and consumed only once a settle produces a decision; else the real answer reads as
   * drift. SEE: docs/decisions/0008-campus-camera-reconciliation.md ("Consequences")
   */
  const awaitingExplicitCameraResult = useRef<CameraRequest | null>(null);

  const applyCameraRequest = useCallback((event: CameraRequestEvent) => {
    awaitingExplicitCameraResult.current = reduceCameraRequest(awaitingExplicitCameraResult.current, event);
  }, []);

  /**
   * WHY: neither route carries a whole camera (`animateCameraTo` has no tilt or bearing, the prop no duration),
   * so `moveCamera` reads the current attitude at call time. A `request` is marked before the move.
   */
  /**
   * WHY: stable, so `moveTo` and what it feeds keep their identity across a tab switch; `framed` leaves a
   * remounted view's camera to the restore.
   */
  const markFramed = useStableHandler(() => dispatchTask(activeTab, { type: 'framed' }));

  const moveTo = useCallback(
    (target: MapChipCamera, { request }: { request: CameraRequestKind | null }) => {
      if (request) {
        applyCameraRequest({ type: 'raise', kind: request, at: Date.now() });
        cameraTaken.current = true;
      }
      if (request === 'sheet') markFramed();
      moveCamera(target, {
        current: getCurrentCamera(),
        animate: (arg) => mapRef.current?.animateCameraTo(arg),
        command: commandCamera,
      });
    },
    [commandCamera, getCurrentCamera, markFramed, applyCameraRequest, mapRef],
  );

  /**
   * QUIRK(naver-map): fit-bounds fits the box whole at the largest zoom that does and sets tilt and bearing to 0,
   * so the attitude branch does not apply; a lone point takes `moveTo` at the marker-focus zoom.
   */
  const fitBounds = useCallback(
    (points: readonly (LatLng | null)[], { request }: { request: CameraRequestKind | null }) => {
      const frame = frameOf(points);
      if (!frame) return;
      if (frame.kind === 'point') {
        moveTo(toPointCamera(frame, cameraDefaults.markerFocus), { request });
        return;
      }
      if (request) {
        applyCameraRequest({ type: 'raise', kind: request, at: Date.now() });
        cameraTaken.current = true;
      }
      if (request === 'sheet') markFramed();
      // QUIRK(android): Fabric runs a batch's view commands before its prop updates, so a fit in the commit that
      // changes `mapPadding` would fit the old band. A command from the next frame cannot be reordered before it.
      if (pendingFit.current !== null) cancelAnimationFrame(pendingFit.current);
      devLog('map.fitBounds', { request });
      pendingFit.current = requestAnimationFrame(() => {
        pendingFit.current = null;
        const space = fitSpace.current;
        const { sw, ne } = space ? boundsForPadding(frame, space) : frame;
        mapRef.current?.animateCameraWithTwoCoords({
          coord1: { latitude: sw.lat, longitude: sw.lng },
          coord2: { latitude: ne.lat, longitude: ne.lng },
          duration: 0,
        });
      });
    },
    [moveTo, cameraDefaults, markFramed, applyCameraRequest, mapRef, fitSpace],
  );

  const pendingFit = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingFit.current !== null) cancelAnimationFrame(pendingFit.current);
    },
    [],
  );

  return {
    bearing,
    cameraCommand,
    handleCameraChanged: handleCameraChangedWithStops,
    stopShape,
    resetNorth,
    cameraTaken,
    touchHandlers,
    cameraDefaults,
    awaitingExplicitCameraResult,
    applyCameraRequest,
    moveTo,
    fitBounds,
  };
}
