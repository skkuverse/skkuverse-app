import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';

function SkeletonRow({ opacity }: { opacity: SharedValue<number> }) {
  const styles = useStyles();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.icon, animatedStyle]} />
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Animated.View style={[styles.labelPlaceholder, animatedStyle]} />
          <Animated.View style={[styles.badgePlaceholder, animatedStyle]} />
        </View>
        <Animated.View style={[styles.subtitlePlaceholder, animatedStyle]} />
      </View>
    </View>
  );
}

export function TransitSkeleton() {
  const styles = useStyles();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  return (
    <View style={styles.container}>
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonRow key={i} opacity={opacity} />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    paddingTop: SdsSpacing.x2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    // WHY: matches TransitItemRow, so the skeleton swaps for the rows without a jump.
    paddingVertical: SdsSpacing.x2_5,
    gap: SdsSpacing.x3_5,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.neutralWeak,
  },
  content: {
    flex: 1,
    gap: SdsSpacing.x1_5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  labelPlaceholder: {
    width: 100,
    height: 16,
    borderRadius: SdsRadius.r1,
    backgroundColor: color.bg.neutralWeak,
  },
  badgePlaceholder: {
    width: 40,
    height: 16,
    borderRadius: SdsRadius.r1_5,
    backgroundColor: color.bg.neutralWeak,
  },
  subtitlePlaceholder: {
    width: 160,
    height: 13,
    borderRadius: SdsRadius.r1,
    backgroundColor: color.bg.neutralWeak,
  },
}));
