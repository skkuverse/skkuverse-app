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
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/apple-game/src/layout.ts holds the same INK, SOFT_INK and
 * PAUSE_FILL.
 */
const INK = '#1F5130';
const SOFT_INK = '#4F7558';
const PAUSE_FILL = 'rgba(255, 255, 255, 0.94)';

/** WHY: never takes a touch; every press belongs to the page underneath, and the first starts the round. */
export function Overlay({ phase, hi }: StageProps) {
  const styles = useStyles();
  const { t, tpl } = useT();
  if (phase === 'ready') {
    return (
      <View style={styles.center} pointerEvents="none">
        <StageTitle
          title={t('game.appleGame.title')}
          sub={t('game.appleGame.sub')}
          best={hi > 0 ? tpl('game.best', hi.toLocaleString()) : undefined}
          ink={INK}
          softInk={SOFT_INK}
        />
        <StartPrompt text={t('game.appleGame.tapToStart')} />
      </View>
    );
  }
  if (phase === 'paused') {
    return (
      <View style={styles.center} pointerEvents="none">
        <PauseCard title={t('game.paused')} sub={t('game.appleGame.pausedSub')} ink={INK} softInk={SOFT_INK} fill={PAUSE_FILL} />
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
