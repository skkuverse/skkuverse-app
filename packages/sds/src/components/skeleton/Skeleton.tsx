import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SdsRadius } from '@skkuverse/shared';
import { useSemanticColors } from '../../core/theme';
import { skeletonRadius, skeletonWidth, type SkeletonShape } from './skeletonShape';

export type { SkeletonShape };

const SkeletonContext = createContext<{ progress: SharedValue<number> } | null>(null);

interface SkeletonAnimateProps {
  children: ReactNode;
}

function SkeletonAnimate({ children }: SkeletonAnimateProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  return (
    <SkeletonContext.Provider value={{ progress }}>
      {children}
    </SkeletonContext.Provider>
  );
}

interface SkeletonBaseProps {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export type SkeletonProps = SkeletonBaseProps &
  ({ shape?: SkeletonShape; borderRadius?: never } | { shape?: never; borderRadius?: number });

function SkeletonBlock({ width, height = 16, shape, borderRadius, style }: SkeletonProps) {
  const ctx = useContext(SkeletonContext);
  const color = useSemanticColors();

  const shimmerStyle = useAnimatedStyle(() => {
    if (!ctx) return {};
    const opacity = 0.3 + ctx.progress.value * 0.7;
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        {
          width: skeletonWidth(shape, width, height) as any,
          height,
          borderRadius: skeletonRadius(SdsRadius, shape, borderRadius),
          backgroundColor: color.bg.neutralWeak,
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

export const Skeleton = Object.assign(SkeletonBlock, {
  Animate: SkeletonAnimate,
});
