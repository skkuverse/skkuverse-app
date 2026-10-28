import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretDownIcon, CaretRightIcon, CaretUpIcon } from 'phosphor-react-native';
import {
  useT,
  SdsRadius,
  SdsSpacing,
  withAlpha,
} from '@skkuverse/shared';
import { Badge, Pressable, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { formatListDate } from '../notice-date.rules';
import type { OverviewDto, OverviewSentence, OverviewSource } from './overview.types';

/** CONTRACT(skkuverse-server): skkuverse-server/src/notices/overview/notices-overview.constants.ts sends at most six candidates. */
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥'];

function marker(n: number): string {
  return CIRCLED[n] ?? `(${n})`;
}

/** WHY: about a two-line lead and three lines of points; taller text is cut here and faded. */
const COLLAPSED_BODY_MAX = 128;
const FADE_HEIGHT = 32;

interface Props {
  overview: OverviewDto;
  onOpenSource: (n: number) => void;
}

/**
 * WHY: a cut-off answer hides its source list with the rest, never shows it under the cut; one size below
 * the result rows, since the card aids the results rather than replacing them.
 */
export function NoticeOverviewCard({ overview, onOpenSource }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  // QUIRK(react-native): a child keeps its own height inside a capped parent, so this measures the natural
  // height; until it is known the sources wait, so a long answer never flashes its list.
  const [bodyHeight, setBodyHeight] = useState(0);
  const overflows = bodyHeight > COLLAPSED_BODY_MAX;
  const cut = overflows && !expanded;
  const showSources = expanded || (bodyHeight > 0 && !overflows);

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <View style={expanded ? null : styles.collapsedBody}>
        <View onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          {overview.lead ? (
            <Sentence sentence={overview.lead} lead onOpenSource={onOpenSource} />
          ) : null}
          {overview.points.length > 0 ? (
            <View style={[styles.points, overview.lead ? styles.pointsAfterLead : null]}>
              {overview.points.map((p, i) => (
                <View key={i} style={styles.pointRow}>
                  <Txt typography="t3" color="placeholder">
                    {'•'}
                  </Txt>
                  <View style={styles.pointText}>
                    <Sentence sentence={p} onOpenSource={onOpenSource} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {cut ? (
          <LinearGradient
            pointerEvents="none"
            colors={[`${color.bg.layerDefault}00`, color.bg.layerDefault]}
            style={styles.fade}
          />
        ) : null}
      </View>

      {showSources ? (
        <>
          {/* WHY: no heading; the circled numbers already tie each row to its markers. */}
          <View style={styles.divider} />
          <View>
            {overview.sources.map((s) => (
              <SourceRow key={s.n} source={s} onPress={() => onOpenSource(s.n)} />
            ))}
          </View>
        </>
      ) : null}

      {overflows ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          hitSlop={8}
          bg="transparent"
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Txt typography="t2" fontWeight="medium" color="neutralSubtle">
            {t(expanded ? 'notices.overview.less' : 'notices.overview.more')}
          </Txt>
          {expanded ? (
            <CaretUpIcon size={11} color={color.fg.neutralSubtle} />
          ) : (
            <CaretDownIcon size={11} color={color.fg.neutralSubtle} />
          )}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** WHY: a nested-text marker's target is its glyph alone, so the source rows are the real target. */
function Sentence({
  sentence,
  lead = false,
  onOpenSource,
}: {
  sentence: OverviewSentence;
  lead?: boolean;
  onOpenSource: (n: number) => void;
}) {
  const { tpl } = useT();
  const typography = lead ? 't4' : 't3';
  return (
    <Txt
      typography={typography}
      fontWeight={lead ? 'semiBold' : 'regular'}
      color={lead ? 'neutral' : 'neutralMuted'}
    >
      {sentence.text}
      {sentence.cites.map((n) => (
        <Txt
          key={n}
          typography={typography}
          fontWeight="semiBold"
          color="ai"
          onPress={() => onOpenSource(n)}
          accessibilityRole="link"
          accessibilityLabel={tpl('notices.overview.citation', n)}
        >
          {` ${marker(n)}`}
        </Txt>
      ))}
    </Txt>
  );
}

function SourceRow({ source, onPress }: { source: OverviewSource; onPress: () => void }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  return (
    <Pressable
      onPress={onPress}
      bg="transparent"
      style={styles.sourceRow}
      accessibilityRole="button"
      accessibilityLabel={`${tpl('notices.overview.citation', source.n)}, ${source.title}`}
    >
      <Txt typography="t3" fontWeight="semiBold" color="ai">
        {marker(source.n)}
      </Txt>
      <Txt typography="t2" color="neutralSubtle" numberOfLines={1} style={styles.sourceTitle}>
        {source.title}
      </Txt>
      {source.contentMissing ? (
        <Badge size="xsmall" color="neutralSubtle" backgroundColor="neutralWeak">
          {t('notices.overview.contentMissing')}
        </Badge>
      ) : null}
      <Txt typography="t2" color="placeholder">
        {formatListDate(source.date)}
      </Txt>
      <CaretRightIcon size={11} color={color.fg.placeholder} />
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  points: {
    gap: SdsSpacing.x1,
  },
  pointsAfterLead: {
    marginTop: SdsSpacing.x1_5,
  },
  pointRow: {
    flexDirection: 'row',
    gap: SdsSpacing.x1_5,
  },
  pointText: {
    flex: 1,
  },
  collapsedBody: {
    maxHeight: COLLAPSED_BODY_MAX,
    overflow: 'hidden',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    // WHY: a quarter of the AI green, so the rule belongs to the green-edged card.
    backgroundColor: withAlpha(color.fg.ai, 0.25),
    marginVertical: SdsSpacing.x2_5,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x1,
    borderRadius: SdsRadius.r1,
  },
  sourceTitle: {
    flex: 1,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: SdsRadius.r1,
    gap: SdsSpacing.x0_5,
    marginTop: SdsSpacing.x1,
    paddingVertical: SdsSpacing.x0_5,
  },
}));
