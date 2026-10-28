import { useCallback, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import {
  calculateScaleFeedback,
  pressedBgToken,
  useReduceMotion,
  useSemanticColors,
  type PressableBgToken,
  type PressFeedbackKind,
} from '@skkuverse/sds';
import { resolvePressFeedback } from './catalog.rules';

export interface StaticPress {
  surface: string | undefined;
  onLayout: (event: LayoutChangeEvent) => void;
  scaleStyle: ViewStyle | undefined;
}

// WHY: draws the end of a press with the same policy and scale `usePressFeedback` animates to, so a pressed sample cannot drift from the component.
export function useStaticPress({
  bg,
  feedback = 'both',
  disabled = false,
  loading = false,
}: {
  bg?: PressableBgToken;
  feedback?: PressFeedbackKind;
  disabled?: boolean;
  loading?: boolean;
}): StaticPress {
  const color = useSemanticColors();
  const reducedMotion = useReduceMotion();
  const policy = resolvePressFeedback({
    feedback,
    hasSurface: bg !== undefined,
    disabled,
    loading,
    reducedMotion,
    insideScalingPressable: false,
  });

  const [scale, setScale] = useState(1);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setScale(calculateScaleFeedback(width, height));
  }, []);

  return {
    surface: bg === undefined ? undefined : color.bg[policy.color ? pressedBgToken(bg) : bg],
    onLayout,
    scaleStyle: policy.scale ? { transform: [{ scale }] } : undefined,
  };
}
