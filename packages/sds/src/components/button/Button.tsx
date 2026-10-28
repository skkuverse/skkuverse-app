import React, { Children, forwardRef, Fragment, useEffect, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createRecipe } from '../../core/createRecipe';
import { PressableScopeContext, usePressFeedback } from '../../core/usePressFeedback';
import { Txt, type TxtStyle } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import {
  buttonContainerBase,
  buttonRecipe,
  buttonSizeStyles,
  BUTTON_DISABLED_ROLES,
  buttonSurfaceToken,
  type ButtonSize,
  type ButtonTone,
  type ButtonVariant,
} from './buttonRecipe';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  tone?: ButtonTone;
  variant?: ButtonVariant;
  display?: 'block' | 'full' | 'inline';
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  viewStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TxtStyle>;
  leftAccessory?: ReactNode;
}

type PointerEvents = Pick<ViewProps, 'pointerEvents'>;

const useButtonRecipe = createRecipe(buttonRecipe);

export const buttonVariantMap = useButtonRecipe.variantMap;

export const containerStylesBySize = StyleSheet.create({
  base: buttonContainerBase,
  ...buttonSizeStyles({ spacing: SdsSpacing, radius: SdsRadius }),
});

const sizeToTypography = {
  xsmall: 't3' as const,
  small: 't5' as const,
  medium: 't8' as const,
  large: 't8' as const,
};

export const Button = forwardRef<View, ButtonProps & PointerEvents>(function Button(
  {
    children,
    tone = 'brand',
    onPress,
    size = 'large',
    variant = 'solid',
    display = 'inline',
    disabled = false,
    loading = false,
    viewStyle,
    containerStyle,
    textStyle,
    pointerEvents,
    leftAccessory,
    onPressIn,
    onPressOut,
    onLayout,
    ...restProps
  },
  ref,
) {
  const isInteractive = !(disabled || loading);
  const styles = useButtonRecipe({ tone, variant, size, display, disabled, loading });

  // WHY: a full-width button spans the screen, so its surface stays put and only the content shrinks (SEED's content scale).
  const contentScale = display === 'full';
  const press = usePressFeedback({
    bg: buttonSurfaceToken(tone, variant),
    disabledBg: BUTTON_DISABLED_ROLES.surface,
    disabled,
    loading,
    onPressIn,
    onPressOut,
    onLayout,
  });

  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    if (!loading) return;
    const duration = 400;
    const pulse = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    dot1.value = pulse;
    dot2.value = withDelay(150, pulse);
    dot3.value = withDelay(300, pulse);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts the pulse when loading flips; the dots are shared values
  }, [loading]);

  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  const renderedChildren = Children.map(children, (child, idx) =>
    typeof child === 'string' || typeof child === 'number' ? (
      <Txt
        typography={sizeToTypography[size]}
        style={[txtSlot(styles.label), textStyle]}
        fontWeight="semiBold"
      >
        {child}
      </Txt>
    ) : (
      <Fragment key={idx}>{child}</Fragment>
    ),
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={isInteractive ? onPress : undefined}
      pointerEvents={pointerEvents}
      style={[styles.root, viewStyle]}
      ref={ref}
      {...restProps}
      {...press.triggerProps}
      accessibilityState={{ disabled, ...restProps.accessibilityState }}
    >
      <Animated.View
        style={[styles.container, !contentScale && press.targetAnimatedStyle, containerStyle]}
      >
        <Animated.View style={[styles.surface, press.surfaceAnimatedStyle]} />

        <Animated.View style={[styles.content, contentScale && press.targetAnimatedStyle]}>
          <PressableScopeContext.Provider value={press.scope}>
            {leftAccessory ? <View style={styles.leftAccessory}>{leftAccessory}</View> : null}
            {renderedChildren}
          </PressableScopeContext.Provider>
        </Animated.View>

        {loading && (
          <View style={styles.loading}>
            <View style={styles.dots}>
              {[dotStyle1, dotStyle2, dotStyle3].map((style, i) => (
                <Animated.View key={i} style={[styles.dot, style]} />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});
