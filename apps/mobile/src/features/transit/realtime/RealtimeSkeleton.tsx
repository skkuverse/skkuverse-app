import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';
import { LEFT_PADDING } from './marker-geometry.rules';

export function RealtimeSkeleton() {
  const styles = useStyles();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.infoBar, animatedStyle]} />

      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.stationRow}>
          <Animated.View style={[styles.dot, animatedStyle]} />
          <Animated.View style={[styles.stationName, animatedStyle]} />
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    paddingTop: SdsSpacing.x2,
  },
  infoBar: {
    height: 32,
    marginHorizontal: SdsSpacing.gutter,
    marginBottom: SdsSpacing.x3,
    borderRadius: SdsRadius.r1,
    backgroundColor: color.bg.neutralWeak,
  },
  stationRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: LEFT_PADDING,
    gap: SdsSpacing.x3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.neutralWeak,
  },
  stationName: {
    width: 120,
    height: 16,
    borderRadius: SdsRadius.r1,
    backgroundColor: color.bg.neutralWeak,
  },
}));
