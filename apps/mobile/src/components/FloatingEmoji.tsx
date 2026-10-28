import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Tossface } from '@skkuverse/sds';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** WHY: stagger `delay` across a cluster, or the emoji rise together and read as one moving block. */
export type EmojiSpec = {
  ch: string;
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  rot: number;
  delay: number;
  float?: number;
};

const BOB_DURATION = 4000;
const DEFAULT_FLOAT = 10;

export function FloatingEmoji({ spec }: { spec: EmojiSpec }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, {
          duration: BOB_DURATION,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
  }, [bob, spec.delay]);

  const travel = spec.float ?? DEFAULT_FLOAT;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -travel]) },
      { rotate: `${spec.rot}deg` },
    ],
  }));

  // WHY: the bob moves a view around the emoji, so the emoji stays a plain <Tossface>, which owns its
  // font and its Android headroom.
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.emoji, { left: spec.left, top: spec.top }, animStyle]}
    >
      <Tossface size={spec.size} style={{ lineHeight: spec.size * 1.2 }}>
        {spec.ch}
      </Tossface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: {
    position: 'absolute',
  },
});
