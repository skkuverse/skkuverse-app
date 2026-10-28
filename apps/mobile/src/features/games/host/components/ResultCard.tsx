import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';

const RISE_FROM = 28;

/**
 * QUIRK(react-native-reanimated): a view with `entering` mounts at opacity 0, and glass laid out under it is
 * never drawn, so the rise is an animated style.
 * SEE: docs/reference/design-usage.md ("Motion")
 */
export function ResultCard({ order, children }: { order: number; children: ReactNode }) {
  const y = useSharedValue(RISE_FROM);
  useEffect(() => {
    y.value = withDelay(
      order * 70,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [order, y]);
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={rise}>
      <GlassCard contentStyle={styles.content}>{children}</GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: SdsSpacing.x5, paddingHorizontal: SdsSpacing.x4_5 },
});
