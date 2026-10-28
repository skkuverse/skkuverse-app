/** SEE: docs/decisions/0008-campus-camera-reconciliation.md */

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Camera } from '@mj-studio/react-native-naver-map';
import type { Campus } from '@skkuverse/shared';
import { logCampusContentSelect, logCampusSwitch } from '@/platform/analytics';
import { devLog } from '@/platform/dev-log';
import { toCampusCamera, toRestoreCamera } from '../../camera-targets.rules';
import {
  decideCameraIdle,
  decideRestore,
  type CameraRequest,
  type CameraRequestEvent,
  type CameraRequestKind,
} from '../../camera-request.rules';
import { cameraSnapshotOf } from '../../camera-move.rules';
import { resolveCampusSuggestion } from '../../campus-proximity.rules';
import { cameraOnReveal, type MapTaskAction, type SeenTop } from '../../map-task.rules';
import type { MapCameraDefaults, MapChipCamera, MapConfig, MapTabId } from '../../map-config.types';
import type { MapTaskState } from '../../sheet-stack.types';
import { useStableHandler } from './useStableHandler';

interface UseCampusReconciliationInputs {
  campusSuggestions: boolean;
  mapConfig: MapConfig | null;
  selectedCampus: Campus;
  setSelectedCampus: (campus: Campus) => void;
  silenceSuggestions: () => void;
  suggestionsSilenced: boolean;
  activeTab: MapTabId;
  activeTask: MapTaskState;
  mapTask: MapTaskState;
  dispatchTask: (tab: MapTabId, action: MapTaskAction) => void;
  cameraDefaults: MapCameraDefaults;
  moveTo: (target: MapChipCamera, options: { request: CameraRequestKind | null }) => void;
  awaitingExplicitCameraResult: RefObject<CameraRequest | null>;
  applyCameraRequest: (event: CameraRequestEvent) => void;
  trackingMode: string;
  cycleMode: () => Promise<boolean>;
}

export function useCampusReconciliation({
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
}: UseCampusReconciliationInputs) {
  const suggestionAt = useCallback(
    (latitude: number, longitude: number) =>
      campusSuggestions && mapConfig
        ? resolveCampusSuggestion({
            cameraLat: latitude,
            cameraLng: longitude,
            campuses: mapConfig.campuses,
            selectedCampus,
          })
        : null,
    [campusSuggestions, mapConfig, selectedCampus],
  );

  /** WHY: a tab switch restores nothing and moves only the sheet; a pending locate or chip outranks a restore. */
  const seenTop = useRef<SeenTop | null>(null);
  useEffect(() => {
    const { seen, restore } = cameraOnReveal(seenTop.current, activeTab, activeTask);
    seenTop.current = seen;
    if (!restore) return;
    const decision = decideRestore({
      tab: activeTab,
      resolved: suggestionAt(restore.latitude, restore.longitude),
      request: awaitingExplicitCameraResult.current,
      now: Date.now(),
    });
    if (decision.kind === 'move') moveTo(toRestoreCamera(restore), { request: decision.request });
  }, [activeTab, activeTask, moveTo, suggestionAt, awaitingExplicitCameraResult]);

  /** WHY: re-tapping the selected campus changes nothing for the effect to observe, so it asks for the move directly. */
  const focusCampus = useCallback(
    (campusId: Campus, durationMs: number = cameraDefaults.campusFocus.durationMs) => {
      const campus = mapConfig?.campuses.find((c) => c.id === campusId);
      if (!campus) return;
      devLog('map.focusCampus', { campusId, durationMs });
      // WHY: the campus's own attitude, server-set, so framing a campus straightens a rotated map.
      moveTo(toCampusCamera(campus, durationMs), { request: null });
    },
    [mapConfig, moveTo, cameraDefaults],
  );

  /**
   * WHY: only the `switch` suggestion skips the effect, since the camera is already on that campus. A ref, so
   * setting it causes no render.
   */
  const suppressNextCampusFocus = useRef(false);

  // WHY: opening a place never sets the campus (ADR 0022 d5).
  useEffect(() => {
    if (suppressNextCampusFocus.current) {
      suppressNextCampusFocus.current = false;
      return;
    }
    focusCampus(selectedCampus);
  }, [selectedCampus, focusCampus]);

  const suggestion = activeTab === 'map' ? mapTask.suggestion : null;

  /** WHY: once per settle, never during a pan. */
  const handleCameraIdle = useStableHandler(
    (camera: Camera) => {
      const snapshot = cameraSnapshotOf(camera);
      if (snapshot) dispatchTask(activeTab, { type: 'rememberCamera', camera: snapshot });
      if (!mapConfig) return;
      const { decision, pending } = decideCameraIdle({
        tab: activeTab,
        resolved: suggestionAt(camera.latitude, camera.longitude),
        request: awaitingExplicitCameraResult.current,
        now: Date.now(),
        silenced: suggestionsSilenced,
        dismissedKey: mapTask.dismissedSuggestion,
      });
      applyCameraRequest({ type: 'settle', pending });

      switch (decision.kind) {
        case 'agree':
          // WHY: the next disagreement is a new situation, so the old dismissal must not silence it.
          dispatchTask('map', { type: 'resetSuggestion' });
          return;
        case 'switch':
          // WHY: the camera is already where the user asked; re-framing the campus centre would undo that move.
          suppressNextCampusFocus.current = true;
          setSelectedCampus(decision.campus);
          logCampusSwitch(decision.campus);
          dispatchTask('map', { type: 'suggest', suggestion: null });
          return;
        case 'show':
          dispatchTask('map', { type: 'suggest', suggestion: decision.suggestion });
          return;
        case 'none':
          return;
      }
    },
  );

  /**
   * WHY: `switch` moves the toggle alone, since the camera is already on that campus and re-framing would pull
   * the map from under the user; `show` is the opposite case.
   */
  const handleSuggestionAccept = useCallback(() => {
    if (!suggestion) return;
    const { campus, variant } = suggestion;
    logCampusContentSelect({ content_type: 'campus_suggestion', item_id: `${variant}:accept` });
    dispatchTask('map', { type: 'resetSuggestion' });

    if (campus !== selectedCampus) {
      suppressNextCampusFocus.current = variant === 'switch';
      setSelectedCampus(campus);
      logCampusSwitch(campus);
      return;
    }
    focusCampus(campus);
  }, [suggestion, selectedCampus, setSelectedCampus, focusCampus, dispatchTask]);

  /**
   * WHY: raised before the await and lowered if tracking did not come on; a request left standing after a
   * refused permission would make the next pan look like a locate result.
   */
  const handleLocatePress = useCallback(async () => {
    // WHY: the mode the press left, since the one it reached is known only after permission.
    logCampusContentSelect({ content_type: 'locate_button', item_id: `from:${trackingMode}` });
    applyCameraRequest({ type: 'raise', kind: 'locate', at: Date.now() });
    const activated = await cycleMode();
    if (!activated) applyCameraRequest({ type: 'cancel' });
  }, [cycleMode, trackingMode, applyCameraRequest]);

  const handleSuggestionDismiss = useCallback(() => {
    if (!suggestion) return;
    logCampusContentSelect({ content_type: 'campus_suggestion', item_id: `${suggestion.variant}:dismiss` });
    dispatchTask('map', { type: 'dismissSuggestion' });
  }, [suggestion, dispatchTask]);

  // WHY: keyed on what the card says, since every camera idle re-derives an equal suggestion.
  const suggestionKey = suggestion ? `${suggestion.campus}:${suggestion.variant}` : null;

  const suggestionVariant = suggestion?.variant;
  useEffect(() => {
    if (suggestionKey && suggestionVariant) {
      logCampusContentSelect({ content_type: 'campus_suggestion', item_id: `${suggestionVariant}:shown` });
    }
  }, [suggestionKey, suggestionVariant]);

  /** WHY: re-tapping the active segment is the natural "take me back"; only a real switch is logged. */
  const handleCampusPick = useCallback(
    (campusId: Campus) => {
      silenceSuggestions();
      // WHY: a choice answers the card and outranks a locate still waiting on its camera.
      applyCameraRequest({ type: 'cancel' });
      dispatchTask('map', { type: 'suggest', suggestion: null });
      if (campusId === selectedCampus) {
        focusCampus(campusId);
        return;
      }
      setSelectedCampus(campusId);
      logCampusSwitch(campusId);
    },
    [selectedCampus, setSelectedCampus, silenceSuggestions, focusCampus, dispatchTask, applyCameraRequest],
  );

  return {
    focusCampus,
    suppressNextCampusFocus,
    suggestion,
    handleCameraIdle,
    handleSuggestionAccept,
    handleSuggestionDismiss,
    handleLocatePress,
    handleCampusPick,
  };
}
