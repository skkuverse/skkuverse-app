/**
 * WHY: below the top detent gorhom locks the list, and the index gate keeps those events off the bar
 * (ADR 0023 d3). Under Reduce Motion and the native tabs nothing reads the minimize state this writes.
 */

import { createContext, use, useCallback } from 'react';
import { useIsFocused } from 'expo-router/react-navigation';
import { useScrollEventsHandlersDefault, type ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';
import { scrollTo, useAnimatedReaction, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { decideHandOver } from '@/components/tab-bar-minimize.rules';
import { followScroll, setMinimized, useTabBarMinimize } from '@/components/useTabBarMinimize';
import { drivesBarAt } from '../sheet-detents.rules';
import { holdLockAt } from './list-hold.rules';

export const SheetDrivesBarContext = createContext<SharedValue<boolean> | null>(null);

/** WHY: the one channel from a view to its list's scroll handlers; the stack owns it, the view writes it. */
export const SheetListHoldContext = createContext<SharedValue<number | null> | null>(null);

/** WHY: expands the bar when driving ends, so nothing leaves it minimized with no way back. */
export function useSheetDrivesBar(sheetIndex: SharedValue<number>, barIndex: number): SharedValue<boolean> {
  const focused = useIsFocused();
  const minimize = useTabBarMinimize();
  const drives = useDerivedValue(() => focused && drivesBarAt(sheetIndex.get(), barIndex), [focused, barIndex]);
  useAnimatedReaction(
    () => drives.get(),
    (now, before) => {
      const next = decideHandOver(before ?? false, now);
      if (next !== null) setMinimized(minimize, next);
    },
    [minimize],
  );
  return drives;
}

/**
 * QUIRK(gorhom-bottom-sheet): its default handlers, patched for Fabric re-entry. A held offset is written into
 * gorhom's lock (`holdLockAt`) on the first scroll event after it, so the lock keeps the list there; once
 * written it is gorhom's.
 */
export const useSheetScrollEvents: ScrollEventsHandlersHookType = (scrollableRef, contentOffsetY) => {
  const handlers = useScrollEventsHandlersDefault(scrollableRef, contentOffsetY);
  const drives = use(SheetDrivesBarContext);
  const holdRequest = use(SheetListHoldContext);
  const minimize = useTabBarMinimize();
  const previousY = useSharedValue(0);
  const pending = useSharedValue<number | null>(null);
  useAnimatedReaction(
    () => holdRequest?.get() ?? null,
    (y) => {
      if (y === null || !holdRequest) return;
      holdRequest.set(null);
      pending.set(y);
      // @ts-expect-error -- gorhom types its animated scrollable ref as a RefObject; its own lock hands this ref to `scrollTo` the same way.
      scrollTo(scrollableRef, 0, y, false);
    },
    [holdRequest, scrollableRef],
  );
  const lock = handlers.handleOnScroll;
  const handleOnScroll = useCallback<NonNullable<typeof lock>>(
    (event, context) => {
      'worklet';
      const hold = pending.get();
      if (hold !== null) {
        pending.set(null);
        holdLockAt(context, hold);
      }
      lock?.(event, context);
      followScroll(minimize, previousY, event, 0, drives?.get() ?? false);
    },
    [lock, minimize, previousY, drives, pending],
  );
  return { ...handlers, handleOnScroll };
};
