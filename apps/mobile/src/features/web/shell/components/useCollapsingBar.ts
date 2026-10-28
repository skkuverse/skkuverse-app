import { useCallback, useRef, useState } from 'react';
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BAR_H, CENTER_DROP, COMPACT_H, COMPACT_W, DROP, GAP, PULL, SIDE_PAD } from './bottom-bar.constants';

const COLLAPSE_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) } as const;

export function useCollapsingBar(screenW: number, isBottomBar: boolean) {
  // QUIRK(reanimated): 0 expanded, 1 collapsed; setting it with withTiming from the JS thread
  // is marshalled to the UI thread, so no runOnUI is needed.
  const collapsed = useSharedValue(0);
  const lastY = useRef(0);
  // WHY: measured, though both clusters are one button today, so the pill follows a change.
  const [leftW, setLeftW] = useState(44);
  const [rightW, setRightW] = useState(44);
  const centerInset = (w: number) => SIDE_PAD + w + GAP;
  const expandedW = Math.max(120, screenW - centerInset(leftW) - centerInset(rightW));

  // WHY: translate before scale, so the pull toward the centre keeps its pixel distance.
  const leftStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      opacity: interpolate(c, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(c, [0, 1], [0, PULL], Extrapolation.CLAMP) },
        { translateY: interpolate(c, [0, 1], [0, DROP], Extrapolation.CLAMP) },
        { scale: interpolate(c, [0, 1], [1, 0.7], Extrapolation.CLAMP) },
      ],
      pointerEvents: c > 0.5 ? 'none' : 'auto',
    };
  });
  const rightStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      opacity: interpolate(c, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(c, [0, 1], [0, -PULL], Extrapolation.CLAMP) },
        { translateY: interpolate(c, [0, 1], [0, DROP], Extrapolation.CLAMP) },
        { scale: interpolate(c, [0, 1], [1, 0.7], Extrapolation.CLAMP) },
      ],
      pointerEvents: c > 0.5 ? 'none' : 'auto',
    };
  });
  const centerStyle = useAnimatedStyle(() => {
    const c = collapsed.value;
    return {
      width: interpolate(c, [0, 1], [expandedW, COMPACT_W], Extrapolation.CLAMP),
      height: interpolate(c, [0, 1], [BAR_H, COMPACT_H], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(c, [0, 1], [0, CENTER_DROP], Extrapolation.CLAMP) }],
    };
  });

  const expand = useCallback(() => {
    collapsed.set(withTiming(0, COLLAPSE_TIMING));
    lastY.current = 0;
  }, [collapsed]);

  // SEE: docs/explanation/miniapp-shell.md ("Shell: the registry decides the chrome")
  const onScroll = useCallback(
    (y: number) => {
      if (!isBottomBar) return;
      // WHY: near the top, rubber band included, the bar is always expanded.
      if (y < 10) {
        collapsed.set(withTiming(0, COLLAPSE_TIMING));
        lastY.current = y;
        return;
      }
      const dy = y - lastY.current;
      // WHY: a rubber band's negative offset and a few pixels of jitter are ignored.
      if (y < 0 || Math.abs(dy) < 6) return;
      if (dy > 0) {
        collapsed.set(withTiming(1, COLLAPSE_TIMING));
      } else {
        collapsed.set(withTiming(0, COLLAPSE_TIMING));
      }
      lastY.current = y;
    },
    [collapsed, isBottomBar],
  );

  return { leftW, setLeftW, rightW, setRightW, centerInset, leftStyle, rightStyle, centerStyle, expand, onScroll };
}

export type CollapsingBar = ReturnType<typeof useCollapsingBar>;
