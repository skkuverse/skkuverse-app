import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { SdsPalette, SdsSpacing, type FgColorName, type SemanticColors } from '@skkuverse/shared';
import { Txt } from '../txt';
import { useSemanticColors } from '../../core/theme';

const sizeMap = {
  small: 24,
  medium: 40,
  large: 56,
} as const;

function strokeColorFor(tone: LoaderTone, color: SemanticColors): string {
  if (tone === 'brand') return color.fg.brand;
  if (tone === 'neutral') return color.fg.neutral;
  return SdsPalette.static.white;
}

export type LoaderTone = 'neutral' | 'brand' | 'staticWhite';

export interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  tone?: LoaderTone;
  label?: string;
  delay?: number;
  customStrokeColor?: FgColorName;
  customSize?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}

function LoaderMain({ size = 'large', tone = 'neutral', label, delay, customStrokeColor, customSize, style: containerStyleProp }: LoaderProps) {
  const semantic = useSemanticColors();
  const [visible, setVisible] = useState(!delay);
  const rotation = useSharedValue(0);
  const px = customSize ?? sizeMap[size];
  const color = customStrokeColor !== undefined ? semantic.fg[customStrokeColor] : strokeColorFor(tone, semantic);
  const strokeWidth = px < 30 ? 2.5 : 3;
  const radius = (px - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    if (delay) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <View style={[styles.loaderContainer, containerStyleProp]}>
      <Animated.View style={[{ width: px, height: px }, animatedStyle]}>
        <Svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
          <Circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
            fill="none"
            opacity={0.9}
          />
          <Circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.15}
          />
        </Svg>
      </Animated.View>
      {label != null && (
        <Txt
          typography="t3"
          color="neutralSubtle"
          style={[styles.label, tone === 'staticWhite' && styles.labelStaticWhite]}
        >
          {label}
        </Txt>
      )}
    </View>
  );
}

interface DelayProps {
  children: ReactNode;
  delay?: number;
}

function LoaderDelay({ children, delay = 700 }: DelayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;
  return <>{children}</>;
}

function LoaderCentered(props: LoaderProps) {
  return (
    <View style={styles.centered}>
      <LoaderMain {...props} />
    </View>
  );
}

function LoaderFullScreen(props: LoaderProps) {
  return (
    <View style={styles.fullScreen}>
      <LoaderMain {...props} />
    </View>
  );
}

export const Loader = Object.assign(LoaderMain, {
  Delay: LoaderDelay,
  Centered: LoaderCentered,
  FullScreen: LoaderFullScreen,
});

const styles = StyleSheet.create({
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: SdsSpacing.x3,
  },
  // WHY: over media no role applies, so the label is white in both schemes.
  labelStaticWhite: {
    color: SdsPalette.static.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SdsSpacing.x6,
  },
  fullScreen: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
