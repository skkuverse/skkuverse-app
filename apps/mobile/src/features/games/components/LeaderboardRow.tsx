import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { maskedEmail, type BoardLine } from '../leaderboard.rules';

function Glow({ rank }: { rank: number }) {
  const styles = useStyles();
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = 1;
    glow.value = withTiming(0.35, { duration: 800, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System });
  }, [rank, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, style]} />;
}

export function LeaderboardRow({ line, format }: { line: Exclude<BoardLine, { kind: 'gap' }>; format(score: number): string }) {
  const styles = useStyles();
  const { t } = useT();
  if (line.kind === 'empty') {
    return (
      <View style={styles.row}>
        <Txt typography="t7" fontWeight="bold" color="disabled" style={styles.rank}>
          {line.rank}
        </Txt>
        <View style={[styles.who, styles.blankWho]}>
          <View style={styles.blank} />
        </View>
        <Txt typography="t7" fontWeight="bold" color="disabled">
          -
        </Txt>
      </View>
    );
  }
  const mine = line.kind === 'ghost' || line.mine;
  const topThree = line.rank <= 3;

  return (
    <View style={[styles.row, line.kind === 'ghost' && styles.ghost]}>
      {mine && <Glow rank={line.rank} />}
      <Txt typography="t7" fontWeight="bold" color={topThree ? 'brand' : 'neutralSubtle'} style={styles.rank}>
        {line.rank}
      </Txt>
      <View style={styles.who}>
        {line.kind === 'ghost' ? (
          <View style={styles.nameLine}>
            <Txt typography="t5" fontWeight="semibold" color="neutral">
              {t('game.me')}
            </Txt>
            <Txt typography="t3" color="neutralSubtle" style={styles.after}>
              {t('game.projected')}
            </Txt>
          </View>
        ) : (
          <>
            <View style={styles.nameLine}>
              <Txt typography="t5" fontWeight="semibold" color="neutral" numberOfLines={1} style={styles.name}>
                {line.entry.nickname}
              </Txt>
              {line.entry.emailPrefix !== '' && (
                <Txt typography="t3" color="neutralSubtle" style={styles.after}>
                  {maskedEmail(line.entry.emailPrefix)}
                </Txt>
              )}
              {line.mine && (
                <Txt typography="t3" fontWeight="bold" color="brand" style={styles.after}>
                  {t('game.me')}
                </Txt>
              )}
            </View>
            <Txt typography="t3" color="neutralSubtle">
              {t(line.entry.campus === 'nsc' ? 'campus.nsc' : 'campus.hssc')}
            </Txt>
          </>
        )}
      </View>
      <Txt typography="t7" fontWeight="bold" color="neutral">
        {format(line.kind === 'ghost' ? line.score : line.entry.score)}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: SdsSpacing.x2,
    paddingHorizontal: SdsSpacing.x2_5,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
  ghost: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.stroke.brandSolid },
  glow: { backgroundColor: color.bg.brandWeak, borderRadius: SdsRadius.r3 },
  rank: { width: 32, textAlign: 'center' },
  who: { flex: 1, marginHorizontal: SdsSpacing.x2_5 },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1 },
  after: { marginLeft: SdsSpacing.x1_5 },
  blankWho: { justifyContent: 'center' },
  blank: { width: 72, height: 12, borderRadius: SdsRadius.full, backgroundColor: color.bg.neutralWeak },
}));
