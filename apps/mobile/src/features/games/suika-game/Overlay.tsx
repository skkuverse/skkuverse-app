import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import type { StageProps } from '../games.types';
import { PauseCard } from '../components/PauseCard';
import { StageTitle } from '../components/StageTitle';
import { boxOf } from './box.rules';

/** WHY: the game's own palette, the same in both schemes: the page's lettering brown on the box's cream panel. */
const PALETTE = { ink: '#6B3A17', soft: 'rgba(107,58,23,0.72)', pause: 'rgba(255,255,255,0.94)', hint: 'rgba(107,58,23,0.82)', hintInk: '#FFFFFF' };

/**
 * WHY: it sits exactly on the box the page reports (`boxOf`) and never takes a touch; every press belongs to the
 * page.
 */
export function Overlay({ phase, hi, showControls, rect }: StageProps) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const { width, height } = useWindowDimensions();
  const box = boxOf({ reported: rect, width, height });
  const inBox = { left: box.x, top: box.y, width: box.width, height: box.height };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {phase === 'ready' && (
        <View style={[styles.box, inBox]}>
          <StageTitle
            title={t('game.suikaGame.title')}
            sub={t('game.suikaGame.sub')}
            best={hi > 0 ? tpl('game.best', hi.toLocaleString()) : undefined}
            ink={PALETTE.ink}
            softInk={PALETTE.soft}
          />
          <StartPrompt text={t('game.suikaGame.tapToStart')} />
        </View>
      )}

      {phase === 'paused' && (
        <View style={[styles.box, inBox]}>
          <PauseCard title={t('game.paused')} sub={t('game.suikaGame.pausedSub')} ink={PALETTE.ink} softInk={PALETTE.soft} fill={PALETTE.pause} />
        </View>
      )}

      {phase === 'running' && showControls && (
        <View style={[styles.hintRow, { left: box.x, width: box.width, top: box.y + box.height * 0.62 }]}>
          <View style={styles.hint}>
            <Txt typography="t4" fontWeight="semibold" style={{ color: PALETTE.hintInk }}>
              {t('game.suikaGame.hint')}
            </Txt>
          </View>
        </View>
      )}
    </View>
  );
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
      <Txt typography="t5" fontWeight="bold" style={{ color: PALETTE.ink }}>
        {text}
      </Txt>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(() => ({
  box: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.x4,
  },
  start: { marginTop: SdsSpacing.x6 },
  hintRow: { position: 'absolute', alignItems: 'center' },
  hint: {
    backgroundColor: PALETTE.hint,
    borderRadius: SdsRadius.r4,
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x2,
  },
}));
