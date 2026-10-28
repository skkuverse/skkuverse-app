import { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsShadows, SdsRadius } from '@skkuverse/shared';
import { Pressable, glassFloatShadow } from '@skkuverse/sds';
import { logBusContentSelect } from '@/platform/analytics';
import type { BusContentType } from '@/platform/analytics.types';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

// WHY: must match AdaptiveBanner's height steps, or the button sits over or under the banner.
function estimateBannerHeight(screenWidth: number): number {
  if (screenWidth <= 400) return 50;
  if (screenWidth <= 728) return 60;
  return 90;
}

const FAB_SIZE = 52;
const FAB_GAP = 16;

/** WHY: a scroller under the button pads its content by at least this, so the last rows scroll clear of it. */
export const REFRESH_FAB_CLEARANCE = FAB_SIZE + FAB_GAP;

interface RefreshFabProps {
  color: string;
  onPress: () => void;
  analytics: { content_type: BusContentType; item_id: string };
  bottomInset?: number;
}

export function RefreshFab({ color, onPress, analytics, bottomInset }: RefreshFabProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomOffset = (bottomInset ?? estimateBannerHeight(width) + insets.bottom) + FAB_GAP;
  const lottieRef = useRef<LottieView>(null);

  const handlePress = () => {
    logBusContentSelect(analytics);
    lottieRef.current?.reset();
    lottieRef.current?.play();
    onPress();
  };

  if (GLASS_AVAILABLE) {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.fabContainer, glassFloatShadow, { bottom: bottomOffset }]}
      >
        <GlassView
          style={styles.fabSurface}
          glassEffectStyle="regular"
          isInteractive
        >
          <Pressable feedback="none" style={styles.pressable} onPress={handlePress}>
            <LottieView
              ref={lottieRef}
              source={require('../../../../assets/lottie/refresh.json')}
              style={styles.lottie}
              autoPlay={false}
              loop={false}
              colorFilters={[
                { keypath: 'Layer 1 Outlines.Group 1.Stroke 1', color },
                { keypath: 'Layer 1 Outlines.Group 2.Stroke 1', color },
              ]}
            />
          </Pressable>
        </GlassView>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.fabContainer, styles.fabSurface, styles.fabShadow, { bottom: bottomOffset }]}
      onPress={handlePress}
    >
      {/* WHY: the route color is data, not a role with a pressed pair, so the button only shrinks. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
      <LottieView
        ref={lottieRef}
        source={require('../../../../assets/lottie/refresh.json')}
        style={styles.lottie}
        autoPlay={false}
        loop={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: SdsRadius.full,
  },
  fabShadow: { boxShadow: SdsShadows.level2.boxShadow },
  fabSurface: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
    height: '100%',
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 35,
    height: 35,
  },
});

