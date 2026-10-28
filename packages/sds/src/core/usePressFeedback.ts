/**
 * WHY: React Native's `Pressable` triggers it, not a gesture-handler worklet: it keeps screen reader activation, scroll cancellation, `hitSlop` and long press,
 * and works inside an RN `Modal`, where a gesture-handler gesture on Android needs a root view of its own (ADR 0014).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
  ViewProps,
  ViewStyle,
} from 'react-native';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { SdsCurves, SdsDuration, type BgColorName } from '@skkuverse/shared';
import {
  calculateScaleFeedback,
  pressedBgToken,
  resolvePressFeedback,
  scopeScales,
  type PressableBgToken,
  type PressFeedbackKind,
} from './pressFeedback';
import { surfaceBg } from './surface';
import { useSurface } from './SurfaceContext';
import { useSemanticColors } from './theme';
import { useReduceMotion } from './useReduceMotion';

export const PressableScopeContext = createContext(false);

// WHY: the color and the scale share one progress, so they cannot drift apart; reduce motion is the policy's call, not Reanimated's `System` default, which would also snap the color.
// Shared values go through `get()` / `set()`, the form the React Compiler lint (react-hooks/immutability) accepts.
const [x1, y1, x2, y2] = SdsCurves.pressed;
const PRESS_TIMING: WithTimingConfig = {
  duration: SdsDuration.fast,
  easing: Easing.bezier(x1, y1, x2, y2),
  reduceMotion: ReduceMotion.Never,
};

export interface UsePressFeedbackOptions {
  /** WHY: inside a glass sheet a layer role paints nothing and presses as `transparent` (`surfaceBg`), since the sheet already draws that layer. */
  bg?: PressableBgToken;
  disabledBg?: BgColorName;
  feedback?: PressFeedbackKind;
  disabled?: boolean;
  loading?: boolean;
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
  /** WHY: the scale is measured from the trigger's layout, so a caller's own handler comes here; one set on the element replaces the measurement. */
  onLayout?: ViewProps['onLayout'];
}

type SurfaceStyle = Pick<ViewStyle, 'backgroundColor'>;
type ScaleStyle = Pick<ViewStyle, 'transform'>;

export interface PressFeedbackTriggerProps {
  onPressIn: (event: GestureResponderEvent) => void;
  onPressOut: (event: GestureResponderEvent) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

export interface PressFeedback {
  pressed: boolean;
  triggerProps: PressFeedbackTriggerProps;
  surfaceAnimatedStyle: ReturnType<typeof useAnimatedStyle<SurfaceStyle>>;
  targetAnimatedStyle: ReturnType<typeof useAnimatedStyle<ScaleStyle>>;
  scope: boolean;
}

export function usePressFeedback({
  bg: requestedBg,
  disabledBg,
  feedback = 'both',
  disabled = false,
  loading = false,
  onPressIn,
  onPressOut,
  onLayout,
}: UsePressFeedbackOptions = {}): PressFeedback {
  const color = useSemanticColors();
  const reducedMotion = useReduceMotion();
  const insideScalingPressable = useContext(PressableScopeContext);
  const surface = useSurface();
  const bg = requestedBg === undefined ? undefined : surfaceBg(requestedBg, surface);

  const context = { feedback, hasSurface: bg !== undefined, reducedMotion, insideScalingPressable };
  const policy = resolvePressFeedback({ ...context, disabled, loading });
  const scope = scopeScales(context);
  const interactive = !(disabled || loading);
  const animates = policy.color || policy.scale;

  const progress = useSharedValue(0);
  const pressedScale = useSharedValue(1);
  const [held, setHeld] = useState(false);

  // WHY: released mid-press when disabled or loading, and not brought back if the element turns interactive under the same finger (SEED Lynx's usePressTap).
  const [wasInteractive, setWasInteractive] = useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) setHeld(false);
  }
  useEffect(() => {
    if (interactive) return;
    cancelAnimation(progress);
    progress.set(0);
  }, [interactive, progress]);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      onPressIn?.(event);
      if (!interactive) return;
      // WHY: the animation first: it runs on the UI thread and must not wait for the re-render the state below causes.
      if (animates) progress.set(withTiming(1, PRESS_TIMING));
      setHeld(true);
    },
    [onPressIn, interactive, animates, progress],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      onPressOut?.(event);
      progress.set(withTiming(0, PRESS_TIMING));
      setHeld(false);
    },
    [onPressOut, progress],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      const { width, height } = event.nativeEvent.layout;
      pressedScale.set(calculateScaleFeedback(width, height));
    },
    [onLayout, pressedScale],
  );

  const rest =
    bg === undefined ? undefined : disabled && disabledBg !== undefined ? color.bg[disabledBg] : color.bg[bg];
  const pressedColor = bg === undefined ? undefined : color.bg[pressedBgToken(bg)];
  const colorOn = policy.color;
  const scaleOn = policy.scale;

  // QUIRK(react-native-reanimated): a key an animated style stops returning keeps its last value on the view, so this always returns the same keys.
  const surfaceAnimatedStyle = useAnimatedStyle((): SurfaceStyle => {
    if (rest === undefined || pressedColor === undefined) return {};
    return {
      backgroundColor: colorOn ? interpolateColor(progress.get(), [0, 1], [rest, pressedColor]) : rest,
    };
  });

  const targetAnimatedStyle = useAnimatedStyle((): ScaleStyle => ({
    transform: [{ scale: scaleOn ? 1 + (pressedScale.get() - 1) * progress.get() : 1 }],
  }));

  return {
    pressed: interactive && held,
    triggerProps: { onPressIn: handlePressIn, onPressOut: handlePressOut, onLayout: handleLayout },
    surfaceAnimatedStyle,
    targetAnimatedStyle,
    scope,
  };
}
