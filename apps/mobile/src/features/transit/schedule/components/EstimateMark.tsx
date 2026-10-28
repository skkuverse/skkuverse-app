import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StarFourIcon } from 'phosphor-react-native';
import { useSemanticColors } from '@skkuverse/sds';

const ESTIMATE_MARK = { size: 9, top: 5, dim: 0.3 } as const;
const ESTIMATE_BREATH = { duration: 900, easing: Easing.inOut(Easing.sin) };
const ESTIMATE_SETTLE = { duration: 200, easing: Easing.out(Easing.quad) };

export function EstimateMark({ past, live }: { past: boolean; live: boolean }) {
  const color = useSemanticColors();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const breathing = live && !past && !reduceMotion;

  useEffect(() => {
    if (breathing) {
      opacity.value = withRepeat(withTiming(ESTIMATE_MARK.dim, ESTIMATE_BREATH), -1, true);
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, ESTIMATE_SETTLE);
    }
    return () => cancelAnimation(opacity);
  }, [breathing, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.estimateMark, animated]}>
      <StarFourIcon size={ESTIMATE_MARK.size} color={past ? color.fg.disabled : color.fg.ai} weight="fill" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  estimateMark: {
    marginTop: ESTIMATE_MARK.top,
  },
});
