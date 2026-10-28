import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/wave-run/src/game/render/layout.ts holds the same GROUND_RATIO;
 * the sky sits above it.
 */
const GROUND_RATIO = 0.58;

const SKY_INK = '#073E32';
const SKY_SOFT = 'rgba(7,62,50,0.72)';
const INK = '#FFFFFF';
const PAUSE_FILL = 'rgba(255,255,255,0.94)';
const PAUSE_SOFT = '#3C5A52';

/** WHY: never takes a touch; every press belongs to the page underneath. */
export function Overlay({ phase, showControls }: StageProps) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {phase === 'ready' && (
        <View style={styles.sky}>
          <StageTitle title={t('game.waveRun.title')} sub={t('game.waveRun.sub')} ink={SKY_INK} softInk={SKY_SOFT} />
        </View>
      )}

      {phase === 'paused' && (
        <View style={styles.sky}>
          <PauseCard title={t('game.paused')} sub={t('game.waveRun.pausedSub')} ink={SKY_INK} softInk={PAUSE_SOFT} fill={PAUSE_FILL} />
        </View>
      )}

      {(phase === 'ready' || (phase === 'running' && showControls)) && (
        <View style={styles.field}>
          <View style={styles.controls}>
            <Zone keyLabel={t('game.waveRun.controls.duckKey')} text={t('game.waveRun.controls.duck')} />
            <View style={styles.divider} />
            <Zone keyLabel={t('game.waveRun.controls.jumpKey')} text={t('game.waveRun.controls.jump')} />
          </View>
          {phase === 'ready' && <StartPrompt text={t('game.waveRun.tapToStart')} />}
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
      <Txt typography="t5" fontWeight="bold" style={{ color: INK }}>
        {text}
      </Txt>
    </Animated.View>
  );
}

function Zone({ keyLabel, text }: { keyLabel: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.zone}>
      <View style={styles.key}>
        <Txt typography="t3" fontWeight="bold" style={{ color: SKY_INK }}>
          {keyLabel}
        </Txt>
      </View>
      <Txt typography="t3" style={[styles.zoneText, { color: INK }]}>
        {text}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${GROUND_RATIO * 100}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.x6,
  },
  field: {
    position: 'absolute',
    top: `${GROUND_RATIO * 100}%`,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    // WHY: near the ground line, clear of the crowd the page draws in the field's lower half.
    justifyContent: 'flex-start',
    paddingTop: SdsSpacing.x7,
    paddingHorizontal: SdsSpacing.x4,
  },
  controls: { flexDirection: 'row', alignItems: 'stretch' },
  zone: { flex: 1, alignItems: 'center', paddingHorizontal: SdsSpacing.x2 },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  key: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: SdsRadius.r2,
    paddingHorizontal: SdsSpacing.x2_5,
    paddingVertical: SdsSpacing.x1,
    marginBottom: SdsSpacing.x2,
  },
  zoneText: { textAlign: 'center' },
  start: { marginTop: SdsSpacing.x5 },
}));
