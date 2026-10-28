import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { GLASS_AVAILABLE, GlassSurface, Pressable, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { BAR_H, BAR_MIN_PAD_BOTTOM, BAR_PAD_TOP, SIDE_PAD } from './bottom-bar.constants';
import { ServicePillLabel } from './ServicePillLabel';
import type { CollapsingBar } from './useCollapsingBar';
import type { MiniAppScreenPill, PillLabelTone } from '../pill.rules';

export function BottomBar({
  bar,
  insets,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  pill,
  pillTone,
}: {
  bar: CollapsingBar;
  insets: EdgeInsets;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  pill: MiniAppScreenPill;
  pillTone: PillLabelTone;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { leftW, setLeftW, rightW, setRightW, centerInset, leftStyle, rightStyle, centerStyle } = bar;
  return (
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, BAR_MIN_PAD_BOTTOM) }]}>
        {/* WHY: an unpadded row aligns the three clusters; the safe-area padding sits outside it. */}
        <View style={styles.barRow}>
          <Animated.View
            style={[styles.leftCluster, leftStyle]}
            onLayout={(ev) => setLeftW(ev.nativeEvent.layout.width)}
          >
            <GlassSurface interactive style={styles.bottomNav}>
              <Pressable
                // WHY: real glass answers the press itself; the solid fallback shrinks.
                feedback={GLASS_AVAILABLE ? 'none' : 'scale'}
                onPress={goBack}
                disabled={!canGoBack}
                style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="뒤로"
              >
                <CaretLeftIcon size={21} color={color.fg.neutral} />
              </Pressable>
            </GlassSurface>
          </Animated.View>

          {/* WHY: only the pill's width animates, inside a fixed container, so nothing reflows. */}
          <View
            style={[styles.centerContainer, { left: centerInset(leftW), right: centerInset(rightW) }]}
            pointerEvents="box-none"
          >
            <Animated.View style={centerStyle}>
              <GlassSurface interactive style={styles.titlePill}>
                <Pressable
                  // WHY: inert, since nothing opens from the pill; the glass still answers a touch.
                  feedback="none"
                  style={styles.titlePillBtn}
                  accessibilityLabel="페이지 정보"
                >
                  <ServicePillLabel logo={pill.logo} faviconUri={pill.faviconUri} name={pill.name} tone={pillTone} />
                </Pressable>
              </GlassSurface>
            </Animated.View>
          </View>

          <Animated.View
            style={[styles.rightCluster, rightStyle]}
            onLayout={(ev) => setRightW(ev.nativeEvent.layout.width)}
          >
            <GlassSurface interactive style={styles.bottomNav}>
              <Pressable
                feedback={GLASS_AVAILABLE ? 'none' : 'scale'}
                onPress={goForward}
                disabled={!canGoForward}
                style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="앞으로"
              >
                <CaretRightIcon size={21} color={color.fg.neutral} />
              </Pressable>
            </GlassSurface>
          </Animated.View>

        </View>
      </View>
  );
}

const useStyles = createThemedStyles(() => ({
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: BAR_PAD_TOP,
  },
  barRow: {
    height: BAR_H,
  },
  leftCluster: {
    position: 'absolute',
    left: SIDE_PAD,
    top: 0,
    bottom: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightCluster: {
    position: 'absolute',
    right: SIDE_PAD,
    top: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: SdsRadius.full,
    paddingHorizontal: SdsSpacing.x1,
    gap: 0,
    overflow: 'hidden',
  },
  navBtn: {
    width: 36,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  // WHY: the radius stays at or above half the height, so the pill is a capsule at every size.
  titlePill: {
    width: '100%',
    height: '100%',
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
  titlePillBtn: {
    flex: 1,
    paddingHorizontal: SdsSpacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
  },
}));
