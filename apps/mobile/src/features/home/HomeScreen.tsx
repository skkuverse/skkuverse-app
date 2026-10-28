import { useCallback, useRef } from 'react';
import {
  Platform,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { TossfaceButtonGrid } from '@/components/TossfaceButtonGrid';
import { useScrollToTopOnRetap } from '@/components/useScrollToTopOnRetap';
import { useTabBarInset } from '@/components/useTabBarInset';
import { useMinimizeOnScroll } from '@/components/useTabBarMinimize';
import { MiniAppFeedSection } from '@/features/web/feed/MiniAppFeedSection';
import { HomeHallOfFame } from '@/features/games/leaderboard/HomeHallOfFame';
import { HomeBannerCarousel } from './components/HomeBannerCarousel';
import { homeBottomRoom } from './home.rules';
import { useHome, type HomeScreenPressableSection } from './useHome';

// QUIRK(rnscreens): iOS 26 NativeTabs set the automatic inset on a root ScrollView; under the shared map the
// ScrollView asks for it itself, and older iOS adds the header height by hand. Exit: the native-tabs shell retires.
// SEE: docs/explanation/ios-26-native-tabs-minimize.md
const AUTOMATIC_INSETS = Platform.OS === 'ios' && isLiquidGlassAvailable();
// WHY: Android's opaque header already offsets the content; adding its height there would count it twice.
const NEEDS_MANUAL_HEADER_INSET = Platform.OS === 'ios' && !AUTOMATIC_INSETS;

export function HomeScreen() {
  const styles = useStyles();
  const { sections } = useHome();
  const headerHeight = useHeaderHeight();
  const scrollTopInset = (NEEDS_MANUAL_HEADER_INSET ? headerHeight : 0) + 16;
  const tabBarInset = useTabBarInset();
  const safeBottom = useSafeAreaInsets().bottom;
  const bottom = homeBottomRoom({ automaticInsets: AUTOMATIC_INSETS, tabBarInset, safeBottom });

  // WHY: under the automatic inset the top of the content rests at minus the header height, not 0.
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: AUTOMATIC_INSETS ? -headerHeight : 0, animated: true });
  }, [headerHeight]);
  useScrollToTopOnRetap('home', scrollToTop);

  // WHY: topInset tells the hook the rest offset is minus the header height; read raw, the bar never shrank (ADR 0023 d3).
  const minimizeTabBar = useMinimizeOnScroll({ topInset: AUTOMATIC_INSETS ? headerHeight : 0 });

  // QUIRK(rnscreens): the ScrollView stays the first child, or the tab bar never
  // minimizes and the inset above never applies. SEE: docs/explanation/ios-26-native-tabs-minimize.md
  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentInsetAdjustmentBehavior={AUTOMATIC_INSETS ? 'automatic' : undefined}
      contentContainerStyle={[
        { paddingTop: scrollTopInset, paddingBottom: bottom.paddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={minimizeTabBar}
      scrollEventThrottle={16}
    >
      {sections.map((section) => renderSection(section, styles))}

      {bottom.spacer > 0 ? <View style={{ height: bottom.spacer }} /> : null}
    </Animated.ScrollView>
  );
}

function renderSection(section: HomeScreenPressableSection, styles: ReturnType<typeof useStyles>) {
  switch (section.kind) {
    case 'banner':
      return <HomeBannerCarousel key={section.key} carousel={section.carousel} />;
    case 'feed':
      return <MiniAppFeedSection key={section.key} miniAppId={section.feed.miniAppId} title={section.feed.title} />;
    case 'hall':
      return <HomeHallOfFame key={section.key} gameIds={section.gameIds} />;
    case 'grid':
      return (
        <View key={section.key} style={styles.gridWrap}>
          {section.title ? (
            <View style={styles.sectionHeader}>
              <Txt typography="t9" fontWeight="bold" color="neutral">
                {section.title}
              </Txt>
            </View>
          ) : null}
          <TossfaceButtonGrid items={section.tiles} />
        </View>
      );
  }
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerBasement,
  },
  gridWrap: {
    marginBottom: SdsSpacing.x6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SdsSpacing.x5,
    marginBottom: SdsSpacing.x3,
  },
}));
