import { useEffect, useRef, type RefObject } from 'react';
import type { Campus } from '@skkuverse/shared';
import { logCampusSwitch } from '@/platform/analytics';
import type { CameraRequestEvent, CameraRequestKind } from '../../camera-request.rules';
import type { MapPadding } from '../../camera-move.rules';
import { campusToFollowAtLaunch, launchCameraOf } from '../../launch-camera.rules';
import { topEntry } from '../../map-task.rules';
import type { MapChipCamera, MapConfig, MapTabId } from '../../map-config.types';
import type { MapTaskState } from '../../sheet-stack.types';
import { useLaunchCamera } from '../../useLaunchCamera';
import type { FedPlaces } from '../../map-host.types';

interface UseLaunchFrameInputs {
  launchAtUser: boolean;
  visibleMapKnown: boolean;
  mapConfig: MapConfig | null;
  fedPlaces: FedPlaces;
  mapPadding: MapPadding | undefined;
  activeTab: MapTabId;
  activeTask: MapTaskState;
  selectedCampus: Campus;
  setSelectedCampus: (campus: Campus) => void;
  cameraTaken: RefObject<boolean>;
  suppressNextCampusFocusRef: RefObject<boolean>;
  moveTo: (target: MapChipCamera, options: { request: CameraRequestKind | null }) => void;
  focusCampus: (campusId: Campus, durationMs?: number) => void;
  showUserLocation: () => void;
  applyCameraRequest: (event: CameraRequestEvent) => void;
}

export function useLaunchFrame({
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
  suppressNextCampusFocusRef,
  moveTo,
  focusCampus,
  showUserLocation,
  applyCameraRequest,
}: UseLaunchFrameInputs): void {
  const launch = useLaunchCamera({
    enabled: launchAtUser,
    campuses: mapConfig?.campuses ?? null,
    stops: fedPlaces.bus_stop,
    stations: fedPlaces.subway_station,
  });

  /**
   * QUIRK(naver-map): a padding change keeps the visible map still and moves the coordinate, and the controls are
   * measured a commit after the config, so the launch frames once more as a jump when the visible map is
   * known; a one-shot, never with a sheet up or once anything else moved the camera.
   */
  const framedVisibleMap = useRef(false);
  useEffect(() => {
    if (!visibleMapKnown || !launch || !mapConfig || framedVisibleMap.current) return;
    framedVisibleMap.current = true;
    if (topEntry(activeTask) || cameraTaken.current) return;
    if (launch.kind === 'user') {
      const follow = campusToFollowAtLaunch(launch, selectedCampus);
      if (follow) {
        suppressNextCampusFocusRef.current = true;
        setSelectedCampus(follow);
        logCampusSwitch(follow);
      }
      moveTo(launchCameraOf(launch, mapConfig.campuses, selectedCampus), { request: 'launch' });
      showUserLocation();
      return;
    }
    focusCampus(selectedCampus, 0);
  }, [
    visibleMapKnown,
    launch,
    mapConfig,
    activeTask,
    moveTo,
    showUserLocation,
    focusCampus,
    selectedCampus,
    setSelectedCampus,
    cameraTaken,
    suppressNextCampusFocusRef,
  ]);

  /**
   * QUIRK(naver-map): the SDK answers a padding change with a settle at the shifted coordinate (Android reports
   * `REASON_CONTENT_PADDING`), which a fresh push stamps `'sheet'`.
   */
  const appliedPadding = useRef<MapPadding | undefined>(undefined);
  useEffect(() => {
    const previous = appliedPadding.current;
    appliedPadding.current = mapPadding;
    if (previous === undefined || mapPadding === undefined || previous === mapPadding) return;
    applyCameraRequest({ type: 'padding', tab: activeTab, top: topEntry(activeTask), at: Date.now() });
  }, [mapPadding, activeTab, activeTask, applyCameraRequest]);
}
