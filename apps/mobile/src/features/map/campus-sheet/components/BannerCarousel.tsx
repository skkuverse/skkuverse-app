/**
 * WHY: no drag and no page count. A scroll view fought the sheet's drag and remounted on every width change
 * as the card inset animated; here `aspectRatio` sizes the slot, the width only feeds a UI-thread value,
 * and nothing remounts. Width caps at `ButtonGrid`'s 480 so both share their edges on a tablet.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  AppState,
  Modal,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router/react-navigation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT, type BannerImage, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { handleSduiAction } from '@/features/web/web.service';
import { logSduiContentSelect } from '@/platform/analytics';
import { ColorSchemeProvider, Pressable, createThemedStyles } from '@skkuverse/sds';
import { SchemeStatusBar } from '@/components/SchemeStatusBar';
import type { SduiBannerCarousel } from '@/features/map/campus-sheet/campus-sheet.types';

interface Props {
  section: SduiBannerCarousel;
}

const MAX_WIDTH = 480;

const SLIDE_MS = 450;
const SLIDE_EASING = Easing.out(Easing.cubic);

/** WHY: past this travel the touch is a drag, which belongs to the sheet, and the viewer does not open. */
const TAP_SLOP = 10;

const VIEWER_MARGIN = 24;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function BannerCarousel({ section }: Props) {
  const styles = useStyles();
  const { items } = section;
  const n = items.length;

  // WHY: a random first banner per mount; a visit is short next to a full lap, so starting at the first
  // would give the first few nearly all the exposure.
  const [start] = useState(() => Math.floor(Math.random() * Math.max(n, 1)));
  // WHY: only ever grows; each page is keyed by its step, so the page sliding in stays the same mounted view.
  const [step, setStep] = useState(0);
  const [viewing, setViewing] = useState<BannerImage | null>(null);

  // WHY: neither `position` nor `step` is ever reset, so no frame shows a page jump.
  const position = useSharedValue(0);
  const width = useSharedValue(0);
  const pressed = useSharedValue(0);
  const slotStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value * 0.15 }));

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  const canRotate = n > 1 && section.autoRotateSec > 0 && focused && appActive && viewing === null;

  useEffect(() => {
    if (!canRotate) return undefined;
    const target = step + 1;
    const timer = setTimeout(() => {
      if (reducedMotion) {
        position.value = target;
        setStep(target);
        return;
      }
      position.value = withTiming(target, { duration: SLIDE_MS, easing: SLIDE_EASING }, (finished) => {
        if (finished) runOnJS(setStep)(target);
      });
    }, section.autoRotateSec * 1000);
    return () => clearTimeout(timer);
  }, [canRotate, step, section.autoRotateSec, reducedMotion, position]);

  const itemAt = (s: number) => items[(start + s) % n] as BannerImage;
  const current = n > 0 ? itemAt(step) : undefined;

  const onPress = () => {
    if (!current) return;
    logSduiContentSelect({ content_type: current.action ? 'sdui_banner' : 'sdui_banner_viewer', item_id: current.id });
    if (current.action) {
      handleSduiAction({ ...current.action, source: 'sdui' });
    } else {
      setViewing(current);
    }
  };

  // WHY: a gesture-handler tap, not a Pressable: a Pressable fires for a slide that ends inside it, so a
  // sideways swipe opened the viewer. This one fails once the finger travels and leaves the drag to the sheet.
  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    })
    .onEnd((_e, success) => {
      if (success) runOnJS(onPress)();
    });

  if (!current) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  // WHY: the next page waits off the right edge so its picture loads before it slides in, and is drawn first so
  // the current page is on top in the frame before the first layout, when both sit at x = 0.
  const steps = n > 1 ? [step + 1, step] : [step];

  return (
    <>
      <GestureDetector gesture={tap}>
        <Animated.View
          style={[styles.slot, { aspectRatio: section.aspectRatio }, slotStyle]}
          onLayout={onLayout}
          accessible
          accessibilityRole={current.action ? 'button' : 'imagebutton'}
          accessibilityLabel={current.alt}
          onAccessibilityTap={onPress}
        >
          {steps.map((s) => (
            <Page key={s} step={s} item={itemAt(s)} position={position} width={width} />
          ))}
        </Animated.View>
      </GestureDetector>

      <BannerViewer
        item={viewing}
        aspectRatio={section.aspectRatio}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

function Page({
  step,
  item,
  position,
  width,
}: {
  step: number;
  item: BannerImage;
  position: SharedValue<number>;
  width: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (step - position.value) * width.value }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={{ uri: item.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
}

/** WHY: the app is portrait only, so the picture turns instead of the screen. */
function BannerViewer({
  item,
  aspectRatio,
  onClose,
}: {
  item: BannerImage | null;
  aspectRatio: number;
  onClose(): void;
}) {
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const long = Math.min(
    height - insets.top - insets.bottom - VIEWER_MARGIN * 2,
    (width - VIEWER_MARGIN * 2) * aspectRatio,
  );
  const short = long / aspectRatio;

  return (
    <Modal
      visible={item !== null}
      animationType="fade"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      {/* WHY: dark in either theme, as every photo viewer is. */}
      <ColorSchemeProvider colorMode="dark-only">
        <SchemeStatusBar />
        <ViewerBackdrop>
          <Pressable
            feedback="none"
            style={styles.viewerHit}
            onPress={onClose}
            accessibilityLabel={item?.alt}
            accessibilityHint={t('common.close')}
          >
            {item && (
              <View
                style={{
                  position: 'absolute',
                  width: long,
                  height: short,
                  left: (width - long) / 2,
                  top: (height - short) / 2,
                  transform: [{ rotate: '90deg' }],
                }}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          </Pressable>
        </ViewerBackdrop>
      </ColorSchemeProvider>
    </Modal>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  slot: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: SdsSpacing.x2,
    borderRadius: SdsRadius.r4,
    overflow: 'hidden',
    backgroundColor: color.bg.neutralWeak,
  },
  viewerHit: {
    flex: 1,
  },
}));

function ViewerBackdrop({ children }: { children: ReactNode }) {
  const styles = useViewerStyles();
  return <View style={styles.viewer}>{children}</View>;
}

const useViewerStyles = createThemedStyles(({ color }) => ({
  viewer: {
    flex: 1,
    backgroundColor: color.bg.layerBasement,
  },
}));
