import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { wantedSans, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { FloatingEmoji, type EmojiSpec } from '@/components/FloatingEmoji';
import { logHomeContentSelect } from '@/platform/analytics';
import { handleSduiAction } from '@/features/web/web.service';
import { Pressable, createThemedStyles } from '@skkuverse/sds';

const ACTIVE_DURATION = 2700;
const IDLE_HOLD = 5000;
// WHY: as a carousel page, the morph waits for the slide-in to settle.
const REPLAY_DELAY = 400;

const SPREAD_START = 0.05;
const SPREAD_END = 0.2;
const LEFT_VSWAP_START = 0.25;
const LEFT_VSWAP_END = 0.35;
const RIGHT_VSWAP_START = 0.72;
const RIGHT_VSWAP_END = 0.82;

// WHY: the spread may overshoot, but a swap must not: its slot clips the glyphs.
// QUIRK(reanimated): `bezierFn` returns a plain function a worklet can call; `bezier` returns a factory for `withTiming`.
const TOSS_SPRING = Easing.bezierFn(0.34, 1.56, 0.64, 1);
const SMOOTH = Easing.bezierFn(0.16, 1, 0.3, 1);

// WHY: one linear master clock, each style easing its own phase, so nothing drifts.
function easedPhase(
  value: number,
  start: number,
  end: number,
  curve: (t: number) => number,
): number {
  'worklet';
  const t = (value - start) / (end - start);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return curve(clamped);
}

const HEADING_FONT = 21;
const SLOT_HEIGHT = HEADING_FONT;
const SLOT_GAP = HEADING_FONT * 0.28;

// WHY: each slot fits its final word plus a margin, so no glyph ever clips.
const LEFT_LONG_WIDTH = HEADING_FONT * 2.7;
const RIGHT_LONG_WIDTH = HEADING_FONT * 3.55;
const SHORT_TEXT_WIDTH = HEADING_FONT * 1.7;

// WHY: puts the two short words one space apart, the gap of the final pair.
const LEFT_TIGHT_TRANSLATE = (RIGHT_LONG_WIDTH - SHORT_TEXT_WIDTH) / 2;
const RIGHT_TIGHT_TRANSLATE = -(LEFT_LONG_WIDTH - SHORT_TEXT_WIDTH) / 2;

// WHY: what the tab holds, as its tiles draw it: meals, games, the building map, the hall of fame.
// Positions are percentages of the card, so the cluster follows its height; the
// sizes are drawn for a 3:1 card about 115pt tall on a 375pt phone.
const EMOJIS: readonly EmojiSpec[] = [
  { ch: '\u{1F371}', left: '61%', top: '27%', size: 34, rot: -12, delay: 0 },
  { ch: '\u{1F3AE}', left: '82%', top: '9%', size: 25, rot: 16, delay: 800 },
  { ch: '\u{1F3E2}', left: '75%', top: '59%', size: 23, rot: -10, delay: 1400 },
  { ch: '\u{1F3C6}', left: '89%', top: '46%', size: 21, rot: 10, delay: 2000 },
];

interface HeroBannerProps {
  // WHY: as a carousel page, the slot sets the height, margins and clip.
  fill?: boolean;
  // WHY: replays the morph each time it turns true; absent means it loops alone.
  active?: boolean;
}

// eslint-disable-next-line sds/no-handbuilt-part -- a page of the home banner carousel, not a callout
export function HeroBanner({ fill = false, active }: HeroBannerProps = {}) {
  const styles = useStyles();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active !== undefined) {
      cancelAnimation(progress);
      progress.value = 0;
      if (active) {
        progress.value = withDelay(
          REPLAY_DELAY,
          withTiming(1, { duration: ACTIVE_DURATION, easing: Easing.linear }),
        );
      }
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ACTIVE_DURATION,
          easing: Easing.linear,
        }),
        withDelay(IDLE_HOLD, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [active, progress]);

  const leftSlotStyle = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      SPREAD_START,
      SPREAD_END,
      TOSS_SPRING,
    );
    return {
      transform: [{ translateX: LEFT_TIGHT_TRANSLATE * (1 - eased) }],
    };
  });

  const rightSlotStyle = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      SPREAD_START,
      SPREAD_END,
      TOSS_SPRING,
    );
    return {
      transform: [{ translateX: RIGHT_TIGHT_TRANSLATE * (1 - eased) }],
    };
  });

  const leftRow1Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      LEFT_VSWAP_START,
      LEFT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: -SLOT_HEIGHT * eased }],
    };
  });

  const leftRow2Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      LEFT_VSWAP_START,
      LEFT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: SLOT_HEIGHT * (1 - eased) }],
    };
  });

  const rightRow1Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      RIGHT_VSWAP_START,
      RIGHT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: -SLOT_HEIGHT * eased }],
    };
  });

  const rightRow2Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      RIGHT_VSWAP_START,
      RIGHT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: SLOT_HEIGHT * (1 - eased) }],
    };
  });

  return (
    <Pressable
      bg="brandWeak"
      style={[styles.card, fill ? styles.cardFill : styles.cardStandalone]}
      onPress={() => {
        logHomeContentSelect({ content_type: 'hero', item_id: 'instagram' });
        handleSduiAction({
          actionType: 'external',
          actionValue: 'https://www.instagram.com/skkuverse.app',
        });
      }}
      accessibilityRole="link"
      accessibilityLabel="스꾸버스 인스타그램 열기"
    >
      {/* WHY: no font scaling; the slots are fixed widths measured from the glyphs. */}
      <Text style={styles.subhead} allowFontScaling={false}>내 손 안에, 성균관대</Text>

      <View style={styles.wordmarkRow}>
        <Animated.View style={[styles.leftSlot, leftSlotStyle]}>
          <Animated.View style={[styles.row, leftRow1Style]}>
            <Text style={styles.wordmark} allowFontScaling={false}>스꾸</Text>
          </Animated.View>
          <Animated.View style={[styles.row, leftRow2Style]}>
            <Text style={styles.wordmark} allowFontScaling={false}>성균관</Text>
          </Animated.View>
        </Animated.View>

        <View style={styles.slotGap} />

        <Animated.View style={[styles.rightSlot, rightSlotStyle]}>
          <Animated.View style={[styles.row, rightRow1Style]}>
            <Text style={styles.wordmark} allowFontScaling={false}>버스</Text>
          </Animated.View>
          <Animated.View style={[styles.row, rightRow2Style]}>
            <Text style={styles.wordmark} allowFontScaling={false}>유니버스</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <FloatingEmoji spec={EMOJIS[0]} />
      <FloatingEmoji spec={EMOJIS[1]} />
      <FloatingEmoji spec={EMOJIS[2]} />
      <FloatingEmoji spec={EMOJIS[3]} />

    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    paddingHorizontal: SdsSpacing.x5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardStandalone: {
    height: 96,
    marginHorizontal: SdsSpacing.x4,
    marginBottom: SdsSpacing.x3,
    borderRadius: SdsRadius.r4,
  },
  cardFill: {
    flex: 1,
  },
  subhead: {
    ...wantedSans('700'),
    fontSize: HEADING_FONT,
    lineHeight: HEADING_FONT * 1.2,
    color: color.fg.neutral,
    letterSpacing: -HEADING_FONT * 0.03,
    textAlign: 'left',
  },
  wordmarkRow: {
    marginTop: SdsSpacing.x1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  leftSlot: {
    width: LEFT_LONG_WIDTH,
    height: SLOT_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  rightSlot: {
    width: RIGHT_LONG_WIDTH,
    height: SLOT_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  slotGap: {
    width: SLOT_GAP,
  },
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  wordmark: {
    ...wantedSans('700'),
    fontSize: HEADING_FONT,
    lineHeight: SLOT_HEIGHT,
    color: color.fg.brandContrast,
    letterSpacing: -HEADING_FONT * 0.03,
    textAlign: 'center',
  },
}));
