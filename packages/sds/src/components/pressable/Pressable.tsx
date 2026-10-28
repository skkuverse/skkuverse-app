/** WHY: `disabled` and `loading` keep the touch, so it never falls through to what is behind, but give no feedback and no `onPress`. */
import React, { forwardRef, type ReactNode } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import type { BgColorName } from '@skkuverse/shared';
import Animated from 'react-native-reanimated';
import { PressableScopeContext, usePressFeedback } from '../../core/usePressFeedback';
import type {
  PressableBgToken,
  PressFeedbackKind,
  ScaleScope,
} from '../../core/pressFeedback';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** WHY: the surface is `bg`; a `backgroundColor` here would sit under the animated surface and never change on press. */
export type PressableStyle = Omit<ViewStyle, 'backgroundColor'> & { backgroundColor?: never };

export interface PressableState {
  pressed: boolean;
}

/** WHY: no default `hitSlop`, since a slop guessed here could overlap a neighbour; a small target passes its own to reach 44pt. */
export interface PressableProps
  extends Omit<RNPressableProps, 'style' | 'children' | 'disabled'> {
  /**
   * WHY: inside a glass sheet a layer role paints nothing and presses as `transparent`, so the same row keeps its fill on a page
   * and lets the glass through on the sheet (`surfaceBg`).
   */
  bg?: PressableBgToken;
  disabledBg?: BgColorName;
  feedback?: PressFeedbackKind;
  scaleScope?: ScaleScope;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<PressableStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode | ((state: PressableState) => ReactNode);
}

export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  {
    bg,
    disabledBg,
    feedback,
    scaleScope = 'self',
    disabled = false,
    loading = false,
    style,
    contentStyle,
    children,
    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    onLayout,
    accessibilityRole = 'button',
    accessibilityState,
    ...rest
  },
  ref,
) {
  const press = usePressFeedback({ bg, disabledBg, feedback, disabled, loading, onPressIn, onPressOut, onLayout });
  const interactive = !(disabled || loading);
  const content = typeof children === 'function' ? children({ pressed: press.pressed }) : children;

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, busy: loading, ...accessibilityState }}
      onPress={interactive ? onPress : undefined}
      onLongPress={interactive ? onLongPress : undefined}
      {...rest}
      {...press.triggerProps}
      style={[
        style,
        press.surfaceAnimatedStyle,
        scaleScope === 'self' && press.targetAnimatedStyle,
      ]}
    >
      <PressableScopeContext.Provider value={press.scope}>
        {scaleScope === 'content' ? (
          <Animated.View style={[contentStyle, press.targetAnimatedStyle]}>{content}</Animated.View>
        ) : (
          content
        )}
      </PressableScopeContext.Provider>
    </AnimatedPressable>
  );
});
