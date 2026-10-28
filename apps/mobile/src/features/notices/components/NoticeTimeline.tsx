import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import type { TimelineEntry } from '../timeline.rules';

/** WHY: no headline and no section title, which repeated what the highlight shows; past steps grey out, never fold. */
export function NoticeTimeline({ entries }: { entries: TimelineEntry[] }) {
  const styles = useStyles();
  const { t } = useT();

  if (entries.length === 0) return null;

  return (
    <View style={styles.timeline}>
      {entries.map((entry, i) => (
        <ScheduleRow
          key={`${entry.label ?? 'period'}-${i}`}
          entry={entry}
          fallbackLabel={t('notices.period')}
          isLast={i === entries.length - 1}
        />
      ))}
    </View>
  );
}

function ScheduleRow({
  entry,
  fallbackLabel,
  isLast,
}: {
  entry: TimelineEntry;
  fallbackLabel: string;
  isLast: boolean;
}) {
  const styles = useStyles();
  const isPast = entry.status === 'past';
  const { isHighlighted } = entry;
  const brandStyles = useBrandStyles();

  const labelColor = isHighlighted ? 'brandContrast' : isPast ? 'placeholder' : 'neutral';
  const rangeColor = isHighlighted ? 'brandContrast' : isPast ? 'placeholder' : 'neutralSubtle';

  return (
    <View style={styles.row}>
      {/* WHY: the line stops at the last row, so the timeline reads as ending rather than cut off. */}
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            isPast && styles.dotPast,
            isHighlighted && brandStyles.dotHighlighted,
          ]}
        />
        {!isLast ? <View style={styles.railLine} /> : null}
      </View>

      <View style={styles.rowBody}>
        <Txt
          typography="t5"
          fontWeight={isHighlighted ? 'semibold' : 'medium'}
          color={labelColor}
          // WHY: without it a narrow label breaks mid-word.
          lineBreakStrategyIOS="hangul-word"
        >
          {entry.label ?? fallbackLabel}
        </Txt>
        <Txt
          typography="t3"
          fontWeight={isHighlighted ? 'semibold' : 'regular'}
          color={rangeColor}
        >
          {entry.range}
        </Txt>
      </View>
    </View>
  );
}

const DOT_SIZE = 7;
const RAIL_WIDTH = 18;

const useStyles = createThemedStyles(({ color }) => ({
  timeline: {
    marginTop: SdsSpacing.x6,
  },
  row: {
    flexDirection: 'row',
    gap: SdsSpacing.x2_5,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    // WHY: half of t5's 22.5 line height less the dot's radius, so the dot stays on the first line.
    paddingTop: SdsSpacing.x2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: color.stroke.neutralWeak,
  },
  dotPast: {
    backgroundColor: color.bg.neutralWeak,
  },
  railLine: {
    flex: 1,
    width: 1.5,
    marginTop: SdsSpacing.x1,
    marginBottom: -SdsSpacing.x1,
    backgroundColor: color.stroke.neutralMuted,
  },
  rowBody: {
    flex: 1,
    paddingBottom: SdsSpacing.x4,
    gap: SdsSpacing.x0_5,
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  dotHighlighted: {
    backgroundColor: color.bg.brandSolid,
    // WHY: color alone fails color-blind readers, so size is a second cue.
    transform: [{ scale: 1.45 }],
  },
}));
