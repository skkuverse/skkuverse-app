import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { SHEET_HANDOFF_CLOSE, SHEET_TAB_SWITCH, type SheetRef } from '@skkuverse/sds';
import { useScreenReader } from '@/platform/useScreenReader';
import { topEntry } from '../map-task.rules';
import { closeSheet } from '../map.service';
import { useMapStore } from '../map.store';
import type { MapTabId } from '../map-config.types';
import type { MapSheetKind } from '../sheet-stack.types';
import type { MapDetent } from '../sheet-detents.constants';
import { indexOfLevel, levelAtIndex, nearestLevel, openingLevel, type MapSheetStops } from '../sheet-detents.rules';
import {
  IDLE_HANDOFF,
  isClosedAt,
  releaseHandoff,
  requestHandoff,
  sheetSettled,
  type SheetHandoff,
} from '../sheet-handoff.rules';
import { decideSheetMove, tabSwitchSnap, toSheetStackLayout, type SeenSheet } from '../sheet-stack.rules';
import { useMapLayout } from '../useMapLayout';
import { useMapRegistry } from '../useMapRegistry';
import { useMapTask } from '../useMapTask';

export function useSheetStack(
  tab: MapTabId,
  stops: MapSheetStops,
  cardRefs: ReadonlyMap<MapSheetKind, RefObject<SheetRef | null>>,
  onRootDetent?: (detent: MapDetent) => void,
) {
  const { task } = useMapTask(tab);
  const { views } = useMapRegistry();
  const layout = useMapLayout();
  const { sheetTop } = layout;
  const dispatchTask = useMapStore((s) => s.dispatchTask);
  const sheetRef = useRef<SheetRef>(null);

  /**
   * QUIRK(gorhom-bottom-sheet): it retargets a running snap by index onto new snap points, so a report is read
   * against the stops it holds when it lands, not its render's.
   */
  const stopsNow = useRef(stops);
  useLayoutEffect(() => {
    stopsNow.current = stops;
  }, [stops]);

  /**
   * QUIRK(gorhom-bottom-sheet): it reports -1 until its first layout; seeded at 0 so the card floats from its
   * first visible frame.
   */
  const sheetIndex = useSharedValue(0);

  /**
   * QUIRK(react-native-reanimated): a zero-length `timing` finishes inside the worklet that starts it, so the next
   * frame's snap starts from the outgoing tab's height (ADR 0022 d3). Under Reduce Motion the sheet stays put.
   */
  const activeTab = useMapStore((s) => s.activeTab);
  const reducedMotion = useReducedMotion();
  /**
   * WHY: a chip can lower the hidden map tab's sheet a frame before the switch reads the index, so the live
   * index would undo the reveal.
   */
  const aimed = useRef<MapDetent | null>(null);
  const laidOut = useRef(false);
  const previousTab = useRef(activeTab);
  const { containerHeight } = layout;
  useEffect(() => {
    const previous = previousTab.current;
    previousTab.current = activeTab;
    if (activeTab !== tab || previous === tab || reducedMotion) return;
    const snap = tabSwitchSnap({
      containerHeight,
      outgoingTop: sheetTop[previous].get(),
      ownTop: sheetTop[tab].get(),
      live: nearestLevel(stopsNow.current, sheetIndex.get()),
      aimed: aimed.current,
      reported: laidOut.current,
    });
    if (!snap) return;
    sheetRef.current?.snapToPosition(snap.startHeight, { duration: 0 });
    const frame = requestAnimationFrame(() =>
      sheetRef.current?.snapToIndex(indexOfLevel(stopsNow.current, snap.level), SHEET_TAB_SWITCH),
    );
    return () => cancelAnimationFrame(frame);
  }, [activeTab, tab, reducedMotion, sheetTop, containerHeight, sheetIndex]);

  /** WHY: two sheets never stack. Refs, not state: a re-render per detent report would re-render the whole map. */
  const handoff = useRef<SheetHandoff>(IDLE_HANDOFF);
  const waitingModal = useRef<RefObject<SheetRef | null> | null>(null);

  const presentOverSheet = useCallback(
    (modal: RefObject<SheetRef | null>) => {
      // WHY: the live index: a sheet still rising back from the previous card has reported nothing and reads as down.
      const live = sheetIndex.get();
      const { state, close, present } = requestHandoff(handoff.current, {
        closed: isClosedAt(live),
        nearest: nearestLevel(stopsNow.current, Math.max(0, live)) ?? 'min',
      });
      handoff.current = state;
      if (close) {
        waitingModal.current = modal;
        // WHY: short, since the card waits for it; the default spring read as a pause after the tap.
        sheetRef.current?.close(SHEET_HANDOFF_CLOSE);
      }
      // WHY: `present` is optional on a SheetRef, and every card this hands off to is a modal.
      if (present) modal.current?.present?.();
    },
    [sheetIndex],
  );

  const handleSheetSettled = useCallback((level: MapDetent | 'closed') => {
    const { state, present } = sheetSettled(handoff.current, level);
    handoff.current = state;
    if (present) {
      const modal = waitingModal.current;
      waitingModal.current = null;
      modal?.current?.present?.();
    }
  }, []);

  const reported = useRef<{ id: number; detent: MapDetent } | null>(null);
  const rootDetent = useRef<MapDetent | null>(null);

  /** WHY: only a change is written, since the reducer returns a new task even for an equal detent. */
  const recordDetent = useCallback(
    (detent: MapDetent | null) => {
      if (!detent) return;
      const { stack } = useMapStore.getState().tasks[tab];
      if (!stack.some((entry) => views[entry.request.kind]?.presentation === 'swap')) {
        rootDetent.current = detent;
        onRootDetent?.(detent);
        return;
      }
      const top = topEntry(useMapStore.getState().tasks[tab]);
      if (!top || views[top.request.kind]?.presentation !== 'swap') return;
      reported.current = { id: top.id, detent };
      if (top.detent !== detent) dispatchTask(tab, { type: 'setDetent', detent });
    },
    [tab, views, dispatchTask, onRootDetent],
  );

  // WHY: both on purpose: `onClose` must not be missed, and `sheetSettled` is idempotent for a closed report.
  const handleSheetChange = useCallback(
    (index: number) => {
      aimed.current = null;
      laidOut.current = true;
      const level = levelAtIndex(stopsNow.current, index);
      handleSheetSettled(level ?? 'closed');
      recordDetent(level);
    },
    [handleSheetSettled, recordDetent],
  );
  const handleSheetClose = useCallback(() => handleSheetSettled('closed'), [handleSheetSettled]);

  const releaseSheet = useCallback(() => {
    const { state, snapTo } = releaseHandoff(handoff.current);
    handoff.current = state;
    waitingModal.current = null;
    if (snapTo !== null) sheetRef.current?.snapToIndex(indexOfLevel(stopsNow.current, snapTo));
  }, []);

  /**
   * WHY: the portal host paints after the navigator, so a card closes before navigating and announces it; two
   * refs, since `onDismiss` is not guaranteed to fire before the return focus on a fast round trip.
   */
  const navigatedAway = useRef<number | null>(null);
  const restoreOnFocus = useRef<number | null>(null);
  const gone = useRef<number | null>(null);

  const onNavigateAway = useCallback((id: number) => {
    navigatedAway.current = id;
    restoreOnFocus.current = id;
  }, []);
  const onCardGone = useCallback((id: number) => {
    gone.current = id;
  }, []);

  const onCardDismiss = useCallback(
    (id: number) => {
      // WHY: keep the entry and skip the release, so the inline sheet stays down under the restored card;
      // `restoreTo` survives for the eventual real dismiss.
      if (navigatedAway.current === id) {
        navigatedAway.current = null;
        closeSheet(tab, { kind: 'navigateAway', id });
        return;
      }
      const wasGone = gone.current === id;
      gone.current = null;
      closeSheet(tab, wasGone ? { kind: 'dataGone', id } : { kind: 'cardDismiss', id });
      releaseSheet();
    },
    [tab, releaseSheet],
  );

  /**
   * WHY: `useFocusEffect` fires once the pushed screen has slid away, on every focus, so the navigation arms the
   * ref and this disarms it. `presentOverSheet`, never bare `present()`, to preserve `restoreTo`.
   */
  useFocusEffect(
    useCallback(() => {
      const id = restoreOnFocus.current;
      if (id === null) return;
      restoreOnFocus.current = null;
      const entry = useMapStore.getState().tasks[tab].stack.find((e) => e.id === id);
      const ref = entry && cardRefs.get(entry.request.kind);
      if (ref) presentOverSheet(ref);
    }, [tab, presentOverSheet, cardRefs]),
  );

  /** WHY: raising the sheet under a card would stack the two. */
  const snapTo = useCallback((detent: MapDetent) => {
    if (handoff.current.restoreTo !== null) return;
    aimed.current = detent;
    sheetRef.current?.snapToIndex(indexOfLevel(stopsNow.current, detent));
  }, []);

  /**
   * WHY: a move whose snap points changed in the same commit waits a frame, so gorhom snaps against the detents
   * it now holds. Under a screen reader a sheet opens at its top.
   */
  const screenReader = useScreenReader();
  const seenSheet = useRef<SeenSheet | null>(null);
  const pendingMove = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingMove.current !== null) cancelAnimationFrame(pendingMove.current);
    },
    [],
  );
  const snapKey = JSON.stringify(stops.position);
  useEffect(() => {
    const { seen, move } = decideSheetMove(
      seenSheet.current,
      { layout: toSheetStackLayout(task, views), levels: stops.levels, snapKey, rootDetent: rootDetent.current },
      reported.current,
    );
    seenSheet.current = seen;
    if (move.kind === 'stay') return;
    if (pendingMove.current !== null) {
      cancelAnimationFrame(pendingMove.current);
      pendingMove.current = null;
    }
    const level = move.cause === 'open' ? openingLevel(move.to, stops, screenReader) : move.to;
    if (!move.deferFrame) {
      snapTo(level);
      return;
    }
    // WHY: a tab switch in the same commit reads the aim, not the live index.
    aimed.current = level;
    pendingMove.current = requestAnimationFrame(() => {
      pendingMove.current = null;
      snapTo(level);
    });
  }, [task, views, stops, snapKey, screenReader, snapTo]);

  return {
    sheetRef,
    sheetIndex,
    handleSheetChange,
    handleSheetClose,
    presentOverSheet,
    onCardDismiss,
    onCardGone,
    onNavigateAway,
    snapTo,
  };
}
