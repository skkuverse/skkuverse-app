/** WHY: the touch stays React Native's `Pressable`, which reaches the handler while disabled, so a disabled press can wiggle the box. */
import React, { type ReactNode, useCallback, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SdsDuration, type SdsColor } from '@skkuverse/shared';
import { createRecipe } from '../../core/createRecipe';
import { useSemanticColors } from '../../core/theme';
import { PressableScopeContext, usePressFeedback } from '../../core/usePressFeedback';
import { useControlled } from '../../utils';
import { springConfig } from '../../foundation/easings';
import {
  CHECKBOX_CHECK,
  checkboxLineRadius,
  checkboxRecipe,
  type CheckboxShape,
} from './checkboxRecipe';

export interface CheckboxProps {
  children?: ReactNode;
  checked?: boolean;
  size?: number;
  disabled?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}

const useCheckboxRecipe = createRecipe(checkboxRecipe);

export const checkboxVariantMap = useCheckboxRecipe.variantMap;

function useWiggle() {
  const x = useSharedValue(0);

  const startWiggle = useCallback(() => {
    x.set(
      withSequence(
        withTiming(-3, { duration: 50 }),
        withTiming(3, { duration: 50 }),
        withTiming(-2, { duration: 50 }),
        withTiming(2, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      ),
    );
  }, [x]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return { startWiggle, style: animStyle };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Checkmark({ size, color }: { size: number; color: SdsColor }) {
  const scale = size / 24;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={`M${6 * scale} ${12 * scale}L${10 * scale} ${16 * scale}L${18 * scale} ${8 * scale}`}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function CheckboxBase({
  shape,
  checked: _checked,
  defaultChecked,
  disabled = false,
  size = 24,
  style,
  children,
  onCheckedChange,
  onPress,
  ...pressableProps
}: CheckboxProps & { shape: CheckboxShape }) {
  const [checked, setChecked] = useControlled({
    controlledValue: _checked,
    defaultValue: defaultChecked ?? false,
  });
  const styles = useCheckboxRecipe({ shape, disabled });
  const color = useSemanticColors();

  const press = usePressFeedback({ feedback: 'scale', disabled });
  const { startWiggle, style: wiggleStyle } = useWiggle();
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    bgOpacity.value = withTiming(checked ? 1 : 0, { duration: SdsDuration.fast });
    scale.value = withSequence(
      withSpring(0.85, springConfig('quick')),
      withSpring(1, springConfig('quick')),
    );
  }, [checked, bgOpacity, scale]);

  const handlePress = useCallback(
    (e: any) => {
      if (disabled) {
        startWiggle();
        return;
      }
      onPress?.(e);
      onCheckedChange?.(!checked);
      setChecked(!checked);
    },
    [disabled, onPress, onCheckedChange, checked, setChecked, startWiggle],
  );

  const checkboxAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgAnimStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const corner = shape === 'line' ? { borderRadius: checkboxLineRadius(size) } : undefined;

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.root, style, press.targetAnimatedStyle]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      {...pressableProps}
      {...press.triggerProps}
    >
      <PressableScopeContext.Provider value={press.scope}>
      <Animated.View style={[disabled ? undefined : wiggleStyle]}>
        <Animated.View style={[{ width: size, height: size }, checkboxAnimStyle]}>
          <View style={[styles.box, { width: size, height: size }, corner]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.fill, corner, bgAnimStyle]} />
          {checked && (
            <View style={[StyleSheet.absoluteFill, centered.center]}>
              <Checkmark
                size={size}
                color={color.fg[CHECKBOX_CHECK[disabled ? 'disabled' : 'enabled']]}
              />
            </View>
          )}
        </Animated.View>
      </Animated.View>
      {children != null && <View style={styles.label}>{children}</View>}
      </PressableScopeContext.Provider>
    </AnimatedPressable>
  );
}

function CheckboxLine(props: CheckboxProps) {
  return <CheckboxBase shape="line" {...props} />;
}

function CheckboxCircle(props: CheckboxProps) {
  return <CheckboxBase shape="circle" {...props} />;
}

export const Checkbox = {
  Line: CheckboxLine,
  Circle: CheckboxCircle,
};

const centered = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
