import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { playGameHaptic } from '@/platform/haptics';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { useT, type TranslationKey, SdsRadius, SdsSpacing, SdsTypo } from '@skkuverse/shared';

interface Props {
  headline: string;
  score: number;
  best: number;
  format(score: number): string;
  unit?: string;
  details?: readonly { labelKey: TranslationKey; value: string }[];
  isNewBest: boolean;
}

const COUNT_MS = 900;
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

export function ScoreHeader({ headline, score, best, format, unit, details, isNewBest }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const x = Math.min(1, (Date.now() - start) / COUNT_MS);
      setShown(Math.round(score * easeOutCubic(x)));
      if (x < 1) raf = requestAnimationFrame(step);
      else if (isNewBest) playGameHaptic('success');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score, isNewBest]);

  return (
    <View>
      <Txt typography="t5" fontWeight="semibold" color="neutralSubtle">
        {headline}
      </Txt>
      <View style={styles.scoreLine}>
        {/* eslint-disable-next-line sds/no-rn-text -- a display figure past t13, the scale's top step, which Txt cannot set (styles.score) */}
        <Text allowFontScaling={false} style={styles.score}>
          {format(shown)}
        </Text>
        {unit && (
          <Txt typography="t9" fontWeight="bold" color="neutralMuted" style={styles.unit}>
            {unit}
          </Txt>
        )}
        {isNewBest && (
          <Animated.View
            entering={ZoomIn.springify().dampingRatio(0.55).delay(COUNT_MS).reduceMotion(ReduceMotion.System)}
            style={styles.badge}
          >
            <Txt typography="t3" fontWeight="bold" color="onBrandSolid">
              {t('game.newBest')}
            </Txt>
          </Animated.View>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Txt typography="t5" color="neutralSubtle">
          {t('game.bestLabel')}
        </Txt>
        <Txt typography="t5" fontWeight="semibold" color="neutral">
          {`${format(best)}${unit ?? ''}`}
        </Txt>
      </View>
      {details?.map((d) => (
        <View key={d.labelKey} style={[styles.row, styles.detail]}>
          <Txt typography="t5" color="neutralSubtle">
            {t(d.labelKey)}
          </Txt>
          <Txt typography="t5" fontWeight="semibold" color="neutral">
            {d.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  scoreLine: { flexDirection: 'row', alignItems: 'flex-end', marginTop: SdsSpacing.x1_5 },
  // WHY: the result's display figure, larger than t13, the scale's top step; no step holds it (TYPE-09).
  score: {
    ...SdsTypo.t13Bold,
    includeFontPadding: false,
    color: color.fg.neutral,
    // eslint-disable-next-line sds/no-type-size-literal -- a display figure past the scale's top step; see the comment above
    fontSize: 44,
    // eslint-disable-next-line sds/no-type-size-literal -- the figure's own line box, which the unit's offset below is measured against
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  // eslint-disable-next-line sds/no-spacing-literal -- lifts the unit's baseline onto the 44pt figure's (the line aligns flex-end); a step either side misaligns the two
  unit: { marginLeft: SdsSpacing.x0_5, marginBottom: 7 },
  badge: {
    alignSelf: 'center',
    marginLeft: SdsSpacing.x2_5,
    marginTop: SdsSpacing.x1,
    backgroundColor: color.bg.brandSolid,
    borderRadius: SdsRadius.r2,
    paddingHorizontal: SdsSpacing.x2,
    // eslint-disable-next-line sds/no-spacing-literal -- the SDS medium badge's metrics (badgeRecipe: x2, 3, r2), kept equal to it
    paddingVertical: 3,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.stroke.neutralMuted, marginVertical: SdsSpacing.x3_5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { marginTop: SdsSpacing.x2 },
}));
