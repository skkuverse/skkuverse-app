import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Loader, Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import { SdsRadius, type FgColorName } from '@skkuverse/shared';

interface Props {
  label: string;
  durationMs: number;
  /** WHY: false holds the fill where it is (an ad on screen, the app in the background). */
  running: boolean;
  done: boolean;
  enabled: boolean;
  busy: boolean;
  onPress(): void;
  onExpire(): void;
}

/**
 * WHY: the label is drawn twice, on the pale track and on the fill that clips its copy, so it stays crisp
 * wherever the edge is. The JS clock decides when time is up; the fill only draws it on the UI thread.
 */
export function DrainButton({ label, durationMs, running, done, enabled, busy, onPress, onExpire }: Props) {
  const styles = useStyles();
  const remaining = useRef(durationMs);
  const progress = useSharedValue(1);
  const [width, setWidth] = useState(0);
  const expire = useEffectEvent(() => onExpire());

  useEffect(() => {
    if (done) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 200 });
      return;
    }
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const startedAt = Date.now();
    const left = remaining.current;
    progress.value = withTiming(0, { duration: left, easing: Easing.linear });
    const timeout = setTimeout(() => {
      remaining.current = 0;
      expire();
    }, left);
    return () => {
      clearTimeout(timeout);
      remaining.current = Math.max(0, left - (Date.now() - startedAt));
    };
  }, [running, done, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (done) {
    return (
      <View style={[styles.button, styles.spent]}>
        <Txt typography="t7" fontWeight="bold" color="placeholder">
          {label}
        </Txt>
      </View>
    );
  }

  const content = (ink: FgColorName) =>
    busy ? (
      <Loader size="small" customStrokeColor={ink} />
    ) : (
      <Txt typography="t7" fontWeight="bold" color={ink}>
        {label}
      </Txt>
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      onLayout={onLayout}
      bg="brandWeak"
      style={styles.button}
    >
      {content('brandContrast')}
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]}>
        <View style={[styles.fillInner, { width }]}>{content('onBrandSolid')}</View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  button: {
    height: 56,
    borderRadius: SdsRadius.r4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spent: { backgroundColor: color.bg.neutralWeak },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: color.bg.brandSolid },
  fillInner: { height: '100%', alignItems: 'center', justifyContent: 'center' },
}));
