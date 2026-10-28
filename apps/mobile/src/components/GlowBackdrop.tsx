import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { withAlpha } from '@skkuverse/shared';

/**
 * WHY: the glow shows this far out from the card, so a neighbour that clips or covers must stay at least
 * this far away, or the halo ends in a hard line.
 */
export const GLOW_BLUR = 20;

export interface GlowBackdropProps {
  color: string;
  // WHY: opaque, so the shadow has a solid edge.
  tint: string;
  borderRadius: number;
  breaths: 'forever' | number;
}

const BREATHE = { duration: 1800, easing: Easing.inOut(Easing.sin) };
const FADE_IN = { duration: 600, easing: Easing.out(Easing.quad) };
const SETTLE = { duration: 400, easing: Easing.out(Easing.quad) };

/**
 * WHY: render it as the card's first child, so the content sits above it, in a card that never clips
 * (`overflow: 'hidden'` cuts the shadow off). QUIRK(react-native): `boxShadow` draws on both platforms,
 * where the iOS `shadow*` props leave Android without one; reanimated reads Reduce Motion once, at mount.
 */
export function GlowBackdrop({ color, tint, borderRadius, breaths }: GlowBackdropProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    const toFull = withTiming(1, started.current ? SETTLE : FADE_IN);
    started.current = true;
    if (reduceMotion || breaths === 0) {
      opacity.value = toFull;
      return;
    }
    // WHY: a breath is two legs (down, back up), so a finite count ends at full.
    const legs = breaths === 'forever' ? -1 : breaths * 2;
    opacity.value = withSequence(toFull, withRepeat(withTiming(0.6, BREATHE), legs, true));
  }, [opacity, breaths, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          borderRadius,
          borderColor: withAlpha(color, 0.45),
          backgroundColor: tint,
          // eslint-disable-next-line sds/no-raw-shadow -- a colored glow around the AI card, not elevation: no shadow level is a halo in the card's own color
          boxShadow: `0px 0px ${GLOW_BLUR}px ${withAlpha(color, 0.35)}`,
        },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    // WHY: -1 lays the glow's border over the card's own 1px one.
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
  },
});
