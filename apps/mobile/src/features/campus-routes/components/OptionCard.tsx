import { View } from 'react-native';
import { WarningIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import { Callout, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { BarSegmentView, OptionView, RideExpansion } from '../campus-routes.types';
import { useLineColor, type OnPlacePress } from './RailRow';
import { RouteTimeline } from './RouteTimeline';

const LABEL_MIN_SHARE = 0.12;

export function OptionCard({
  option,
  rides,
  onPlacePress,
}: {
  option: OptionView;
  rides: RideExpansion;
  onPlacePress: OnPlacePress;
}) {
  const styles = useStyles();

  if (option.status === 'notRunning') {
    return (
      <View>
        <View style={styles.card}>
          <Txt typography="t4" fontWeight="bold" color="neutralSubtle">
            {option.name}
          </Txt>
          <Txt typography="t4" color="neutralSubtle">
            {option.statusLine}
          </Txt>
          <Warnings messages={option.warnings} />
        </View>
        <View style={styles.band} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Txt typography="t3" fontWeight="medium" color="neutralSubtle">
          {option.name}
        </Txt>
        <View style={styles.headline}>
          <Duration minutes={option.minutes} />
          <Txt typography="t5" fontWeight="bold" color="brand">
            {option.leave}
          </Txt>
        </View>
        <Warnings messages={option.warnings} />
        <LegBar segments={option.bar} />
        <RouteTimeline timeline={option.timeline} rides={rides} onPlacePress={onPlacePress} />
      </View>
      <View style={styles.band} />
    </View>
  );
}

function Warnings({ messages }: { messages: string[] }) {
  const styles = useStyles();
  if (messages.length === 0) return null;
  return (
    <View style={styles.warnings}>
      {messages.map((message, i) => (
        <Callout key={i} tone="warning" prefixIcon={<WarningIcon weight="fill" />} description={message} />
      ))}
    </View>
  );
}

function Duration({ minutes }: { minutes: number }) {
  const { t } = useT();
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return (
    <Txt typography="t11" fontWeight="bold" color="neutral">
      {hours > 0 ? (
        <>
          {hours}
          <Txt typography="t6" fontWeight="medium" color="neutral">
            {t('campusRoutes.unitHour')}
          </Txt>
          {rest > 0 ? ' ' : ''}
        </>
      ) : null}
      {hours === 0 || rest > 0 ? (
        <>
          {rest}
          <Txt typography="t6" fontWeight="medium" color="neutral">
            {t('campusRoutes.unitMin')}
          </Txt>
        </>
      ) : null}
    </Txt>
  );
}

function LegBar({ segments }: { segments: BarSegmentView[] }) {
  const styles = useStyles();
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  return (
    <View style={styles.bar}>
      {segments.map((segment, i) => (
        <LegSegment key={i} segment={segment} share={segment.minutes / total} />
      ))}
    </View>
  );
}

function LegSegment({ segment, share }: { segment: BarSegmentView; share: number }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { tpl } = useT();
  const fill = useLineColor(segment.color);
  return (
    <View
      style={[
        styles.segment,
        {
          flexGrow: segment.minutes,
          backgroundColor: fill ?? color.bg.neutralWeak,
        },
      ]}
    >
      {share >= LABEL_MIN_SHARE ? (
        <Txt
          typography="t1"
          fontWeight="medium"
          // WHY: white on a line's color in both modes, as on a brand fill.
          color={fill ? 'onBrandSolid' : 'neutralSubtle'}
          numberOfLines={1}
        >
          {tpl('campusRoutes.duration', segment.minutes)}
        </Txt>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x4,
    gap: SdsSpacing.x1,
  },
  band: {
    height: SdsSpacing.x2,
    backgroundColor: color.bg.neutralWeak,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  warnings: {
    marginTop: SdsSpacing.x2,
    gap: SdsSpacing.x2,
  },
  bar: {
    flexDirection: 'row',
    height: SdsSpacing.x4,
    marginTop: SdsSpacing.x1,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.neutralWeak,
    overflow: 'hidden',
    gap: SdsSpacing.x0_5,
  },
  segment: {
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
  },
  shrink: {
    flexShrink: 1,
  },
}));
