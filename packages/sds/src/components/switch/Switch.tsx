import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  type AccessibilityProps,
  type PressableProps,
  type StyleProp,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useControlled } from '../../utils';
import { springConfig } from '../../foundation/easings';
import { createThemedStyles } from '../../core/theme';
import { Pressable, type PressableStyle } from '../pressable';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const TRACK_RADIUS = 15;
const KNOB_SIZE = 16;
const KNOB_OFFSET_OFF = 7;
const KNOB_OFFSET_ON = TRACK_WIDTH - KNOB_SIZE - KNOB_OFFSET_OFF;

export interface SwitchProps extends AccessibilityProps {
  checked?: boolean;
  onCheckedChange?: (value: boolean) => void;
  defaultChecked?: boolean;
  disabled?: boolean;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<PressableStyle>;
}

export default function Switch({
  checked: _checked,
  defaultChecked = false,
  disabled = false,
  style,
  onPress,
  onCheckedChange,
  accessibilityState,
  ...restProps
}: SwitchProps) {
  const styles = useStyles();
  const [checked, setChecked] = useControlled({
    controlledValue: _checked,
    defaultValue: defaultChecked,
  });

  const translateX = useSharedValue(checked ? KNOB_OFFSET_ON : KNOB_OFFSET_OFF);
  const bgOpacity = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    translateX.value = withSpring(
      checked ? KNOB_OFFSET_ON : KNOB_OFFSET_OFF,
      springConfig('quick'),
    );
    bgOpacity.value = withTiming(checked ? 1 : 0, { duration: 200 });
  }, [checked, translateX, bgOpacity]);

  const handlePress = useCallback(
    (e: any) => {
      if (disabled) return;
      onPress?.(e);
      onCheckedChange?.(!checked);
      setChecked(!checked);
    },
    [disabled, onPress, onCheckedChange, checked, setChecked],
  );

  const trackStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    // WHY: the track's color already shows the state, so a press only shrinks it (PRESS-06).
    <Pressable
      feedback="scale"
      disabled={disabled}
      onPress={handlePress}
      style={[styles.container, style]}
      accessibilityRole="switch"
      accessible
      accessibilityState={{ checked, disabled, ...accessibilityState }}
      {...restProps}
    >
      <Animated.View
        style={[
          styles.track,
          { opacity: disabled ? 0.3 : 1 },
        ]}
      >
        <Animated.View style={[styles.trackBg, styles.trackOff]} />
        <Animated.View style={[styles.trackBg, styles.trackOn, trackStyle]} />
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    alignSelf: 'flex-start',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    overflow: 'hidden',
  },
  trackBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: TRACK_RADIUS,
  },
  // WHY: the off track holds SEED's `gray-400` step, which only the line role carries.
  trackOff: {
    backgroundColor: color.stroke.neutralWeak,
  },
  trackOn: {
    backgroundColor: color.bg.brandSolid,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    backgroundColor: color.bg.layerDefault,
    borderRadius: KNOB_SIZE / 2,
    position: 'absolute',
    top: 7,
  },
}));

export { Switch };
