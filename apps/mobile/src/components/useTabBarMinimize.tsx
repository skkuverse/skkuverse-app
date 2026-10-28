// WHY: derived from expo-glass-tabs 0.1.1's `src/minimize-context.tsx` (MIT, David Mokos); the notice is
// `apps/mobile/src/bootstrap/glass-tabs/LICENSE`. It lives here because no feature imports `bootstrap/`.
import { createContext, use, useMemo, type PropsWithChildren } from 'react';
import type { NativeScrollEvent } from 'react-native';
import { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { clampedScrollY, decideMinimize, type MinimizeTarget } from './tab-bar-minimize.rules';

/**
 * EVIDENCE: Instagram's bar settles in about 0.3 s with a 3% overshoot, `spring(response: 0.4, dampingFraction:
 * 0.75)` as physics: stiffness (2π / response)², damping 2 · ratio · √stiffness. WHY: a spring keeps its velocity
 * when the scroll flips mid-flight; reanimated's `duration` form would cross the target in half the time.
 */
export const MINIMIZE_SPRING = { mass: 1, stiffness: 246.7, damping: 23.6 } as const;

export interface MinimizeState {
  progress: SharedValue<number>;
  target: SharedValue<number>;
}

const MinimizeContext = createContext<MinimizeState | null>(null);

export function TabBarMinimizeProvider({ children }: PropsWithChildren) {
  const progress = useSharedValue(0);
  const target = useSharedValue(0);
  const state = useMemo(() => ({ progress, target }), [progress, target]);
  return <MinimizeContext.Provider value={state}>{children}</MinimizeContext.Provider>;
}

/** WHY: outside the provider (the native tabs), a page's handler drives a local state nothing reads. */
export function useTabBarMinimize(): MinimizeState {
  const shared = use(MinimizeContext);
  const progress = useSharedValue(0);
  const target = useSharedValue(0);
  const local = useMemo(() => ({ progress, target }), [progress, target]);
  return shared ?? local;
}

export function useTabBarMinimized(): SharedValue<number> {
  return useTabBarMinimize().progress;
}

/** WHY: a no-op when already heading to `next`, so per-frame scroll events never restart the spring. */
export function setMinimized(state: MinimizeState, next: MinimizeTarget): void {
  'worklet';
  if (state.target.get() !== next) {
    state.target.set(next);
    state.progress.set(withSpring(next, MINIMIZE_SPRING));
  }
}

type ScrollReport = Pick<NativeScrollEvent, 'contentOffset' | 'contentSize' | 'layoutMeasurement'>;

/**
 * WHY: with `drives` false it still tracks the position, so a scroller that drives the bar only part of
 * the time reads no jump on its first driving event.
 */
export function followScroll(
  state: MinimizeState,
  previousY: SharedValue<number>,
  event: ScrollReport,
  topInset: number,
  drives = true,
): void {
  'worklet';
  const y = clampedScrollY({
    offsetY: event.contentOffset.y,
    contentHeight: event.contentSize.height,
    viewportHeight: event.layoutMeasurement.height,
    topInset,
  });
  const dy = y - previousY.get();
  previousY.set(y);
  if (!drives) return;
  const next = decideMinimize(y, dy);
  if (next !== null) setMinimized(state, next);
}

export function useMinimizeOnScroll({ topInset = 0 }: { topInset?: number } = {}) {
  const state = useTabBarMinimize();
  const previousY = useSharedValue(0);

  return useAnimatedScrollHandler(
    {
      onScroll: (event) => followScroll(state, previousY, event, topInset),
    },
    [topInset, state],
  );
}
