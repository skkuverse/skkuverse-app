/**
 * WHY: the veil is a layer of its own rather than the row's background, so a surface the caller gives the row in `style` stays under it;
 * `Pressable`'s `bg` would replace that surface.
 */
import React, { forwardRef, type ReactNode } from 'react';
import {
  Pressable as RNPressable,
  StyleSheet,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { PressableScopeContext, usePressFeedback } from '../../core/usePressFeedback';

export interface RowPressableProps extends Omit<RNPressableProps, 'style' | 'children' | 'disabled'> {
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export const RowPressable = forwardRef<View, RowPressableProps>(function RowPressable(
  {
    style,
    contentStyle,
    children,
    disabled = false,
    onPress,
    onPressIn,
    onPressOut,
    onLayout,
    accessibilityRole = 'button',
    accessibilityState,
    ...rest
  },
  ref,
) {
  const press = usePressFeedback({
    bg: 'transparent',
    disabled,
    onPressIn,
    onPressOut,
    onLayout,
  });

  return (
    <RNPressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
      onPress={disabled ? undefined : onPress}
      {...rest}
      {...press.triggerProps}
      style={[styles.root, style]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, press.surfaceAnimatedStyle]} />
      <Animated.View style={[contentStyle, press.targetAnimatedStyle]}>
        <PressableScopeContext.Provider value={press.scope}>{children}</PressableScopeContext.Provider>
      </Animated.View>
    </RNPressable>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
