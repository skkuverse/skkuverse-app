import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import type { StageProps } from '../games.types';
import { PauseCard } from '../components/PauseCard';
import { StageTitle } from '../components/StageTitle';

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/bigger-building/src/layout.ts holds the same INK, SOFT_INK and
 * PAUSE_FILL.
 */
const INK = '#FFFFFF';
const SOFT_INK = 'rgba(255, 255, 255, 0.72)';
const PAUSE_FILL = 'rgba(0, 0, 0, 0.88)';

/**
 * WHY: the title sits clear of the page's campus control and never takes a touch; the control's taps and the first
 * tap belong to the page.
 */
export function Overlay({ phase, hi }: StageProps) {
  const styles = useStyles();
  const { t, tpl } = useT();
  if (phase === 'ready') {
    return (
      <View style={styles.center} pointerEvents="none">
        <StageTitle
          title={t('game.biggerBuilding.title')}
          sub={t('game.biggerBuilding.sub')}
          best={hi > 0 ? tpl('game.best', hi.toLocaleString()) : undefined}
          ink={INK}
          softInk={SOFT_INK}
        />
        <StartPrompt text={t('game.biggerBuilding.tapToStart')} />
      </View>
    );
  }
  if (phase === 'paused') {
    return (
      <View style={styles.center} pointerEvents="none">
        <PauseCard title={t('game.paused')} sub={t('game.biggerBuilding.pausedSub')} ink={INK} softInk={SOFT_INK} fill={PAUSE_FILL} />
      </View>
    );
  }
  return null;
}

function StartPrompt({ text }: { text: string }) {
  const styles = useStyles();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [scale]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.start, pulse]}>
      <Txt typography="t5" fontWeight="bold" style={{ color: INK }}>
        {text}
      </Txt>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(() => ({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.x6,
  },
  start: { marginTop: SdsSpacing.x6 },
}));
