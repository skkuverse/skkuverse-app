import { useCallback, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  useForeground,
} from 'react-native-google-mobile-ads';

interface Props {
  unitId: string;
  // QUIRK(google-mobile-ads): without a cap the SDK's inline height is the device's screen height,
  // so always pass it. It is also the slot reserved before load.
  maxHeight?: number;
}

// QUIRK(google-mobile-ads): native sizes an adaptive ad from the screen width, not its parent, so a
// padded slot gets a clipped ad (an AdMob policy breach). So the measured width is passed, and
// nothing is requested at width 0.
// eslint-disable-next-line sds/no-handbuilt-part -- an AdMob banner ad, not a callout
export function InlineBanner({ unitId, maxHeight = 250 }: Props) {
  const bannerRef = useRef<BannerAd>(null);
  const [width, setWidth] = useState(0);
  // WHY: the slot keeps maxHeight even for a shorter creative, since shrinking shifts the text being
  // read; only a no-fill, which is common, collapses it.
  const [collapsed, setCollapsed] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));

  // QUIRK(ios): the banner's WKWebView can suspend in the background, so a foreground reloads it.
  useForeground(() => {
    Platform.OS === 'ios' && bannerRef.current?.load();
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    // QUIRK(google-mobile-ads): native rounds a fractional width up, overshooting the slot by 1dp.
    const next = Math.floor(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  if (collapsed) return null;

  return (
    <View
      style={{ height: maxHeight, alignItems: 'center', justifyContent: 'center' }}
      onLayout={handleLayout}
    >
      {width > 0 ? (
        <Animated.View style={{ opacity }}>
          <BannerAd
            ref={bannerRef}
            unitId={unitId}
            size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            width={width}
            maxHeight={maxHeight}
            onAdLoaded={(dimensions) => {
              if (__DEV__) console.log('[AdMob] Inline loaded:', unitId, dimensions);
              setCollapsed(false);
              Animated.timing(opacity, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }).start();
            }}
            onAdFailedToLoad={(error) => {
              if (__DEV__) console.log('[AdMob] Inline failed:', unitId, error.message);
              setCollapsed(true);
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
