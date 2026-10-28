/**
 * WHY: derived from expo-glass-tabs 0.1.1 (MIT, github.com/davidmokos/expo-glass-tabs at f6119a19); the notice is
 * LICENSE in this folder and README.md lists what changed. Everything that moves stays on the UI thread.
 */

import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { SdsRadius, SdsShadows, type SdsColor } from '@skkuverse/shared';
import { Pressable, createThemedStyles, useResolvedScheme, useSemanticColors } from '@skkuverse/sds';
import { setMinimized, useTabBarMinimize, type MinimizeState } from '@/components/useTabBarMinimize';
import { playSelectionTick } from '@/platform/haptics';
import { indexAtX, lensLeft, type TabBarGeometry } from './geometry.rules';
import { lensSpan, scrubReleaseSelects } from './lens.rules';

// EVIDENCE: Phosphor's ink fills about 22 of the box, Instagram's measured glyph.
export const ICON_SIZE = 26;

/**
 * QUIRK(react-native-reanimated): `duration` crosses the target in about half the time asked, so springs are
 * physics: stiffness (2π / response)², damping 2 · ratio · √stiffness. EVIDENCE: Instagram's lens, response 0.33s, ratio 0.85.
 */
const SLIDE_SPRING = { mass: 1, stiffness: 362, damping: 32.4 } as const;

// EVIDENCE: critically damped at response 0.5s, so the lens stretches with speed as Instagram's does.
const TRAIL_SPRING = { mass: 1, stiffness: 158, damping: 25.1 } as const;

const TRAIL_MAX_LAG = 0.35;

// EVIDENCE: UIKit's interactive glass and Instagram's bar, measured 3.1% held, 4.2% peak (response 0.17s, ratio 0.6).
const PRESS_SWELL = 0.035;
const PRESS_SPRING = { mass: 1, stiffness: 1366, damping: 44.3 } as const;

const SCRUB_ACTIVATION = 6;

const SCRUB_FAIL_Y = 14;

const TICKS = Platform.OS === 'ios';

export interface GlassTabItem {
  name: string;
  label: string;
  renderIcon: (props: { size: number; color: SdsColor; filled: boolean }) => ReactNode;
}

interface BarContextValue {
  slide: SharedValue<number>;
  trail: SharedValue<number>;
  scrubbing: SharedValue<boolean>;
  minimize: MinimizeState;
  glyphOffsets: number[];
}

const BarContext = createContext<BarContextValue | null>(null);

export type GlassTabBarProps = TabListProps & {
  geometry: TabBarGeometry;
  focusedIndex: number;
  glass: boolean;
  onIndexSelected: (index: number) => void;
};

export function GlassTabBar({ children, geometry, focusedIndex, glass, onIndexSelected, style, ...props }: GlassTabBarProps) {
  const styles = useStyles();
  const scheme = useResolvedScheme();
  const minimize = useTabBarMinimize();
  const progress = minimize.progress;
  const slide = useSharedValue(Math.max(focusedIndex, 0));
  const trail = useSharedValue(Math.max(focusedIndex, 0));
  const focused = useSharedValue(Math.max(focusedIndex, 0));
  const scrubbing = useSharedValue(false);
  const pressed = useSharedValue(0);
  const scrubStart = useSharedValue(0);
  const crossedCell = useSharedValue(false);
  const lastTicked = useSharedValue(-1);

  useEffect(() => {
    if (focusedIndex < 0) return;
    focused.set(focusedIndex);
    if (scrubbing.get()) return;
    slide.set(withSpring(focusedIndex, SLIDE_SPRING));
    trail.set(withSpring(focusedIndex, TRAIL_SPRING));
    setMinimized(minimize, 0);
  }, [focusedIndex, focused, slide, trail, scrubbing, minimize]);

  // WHY: a tap never activates the pan and reaches the cell's pressable, so one touch presses once.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetX([-SCRUB_ACTIVATION, SCRUB_ACTIVATION])
        .failOffsetY([-SCRUB_FAIL_Y, SCRUB_FAIL_Y])
        .onBegin(() => {
          pressed.set(withSpring(1, PRESS_SPRING));
          setMinimized(minimize, 0);
        })
        .onStart(() => {
          scrubbing.set(true);
          const start = focused.get();
          scrubStart.set(start);
          lastTicked.set(start);
          crossedCell.set(false);
        })
        .onUpdate((event) => {
          const index = indexAtX(event.x, geometry);
          slide.set(index);
          trail.set(withSpring(index, TRAIL_SPRING));
          const rounded = Math.round(index);
          if (rounded !== lastTicked.get()) {
            lastTicked.set(rounded);
            crossedCell.set(true);
            if (TICKS) runOnJS(playSelectionTick)();
          }
        })
        .onFinalize((_event, success) => {
          pressed.set(withSpring(0, PRESS_SPRING));
          // QUIRK(react-native-gesture-handler): onFinalize fires for a tap that never activated the pan.
          if (!scrubbing.get()) return;
          scrubbing.set(false);
          const start = scrubStart.get();
          const release = Math.round(slide.get());
          const selects = success && scrubReleaseSelects({ start, release, crossedCell: crossedCell.get() });
          const target = selects ? release : start;
          slide.set(withSpring(target, SLIDE_SPRING));
          trail.set(withSpring(target, TRAIL_SPRING));
          if (selects) runOnJS(onIndexSelected)(release);
        }),
    [geometry, minimize, onIndexSelected, pressed, scrubbing, slide, trail, focused, scrubStart, crossedCell, lastTicked],
  );

  // WHY: a transform, so the layout box and the inset a page clears never change.
  const capsuleStyle = useAnimatedStyle(() => {
    const shrink = 1 - progress.get() * (1 - geometry.minimizedScale);
    return { transform: [{ scale: shrink * (1 + pressed.get() * PRESS_SWELL) }] };
  });

  const lensStyle = useAnimatedStyle(() => {
    const { from, cells } = lensSpan(slide.get(), trail.get(), TRAIL_MAX_LAG);
    const span = cells * geometry.lens.pitch;
    return {
      transform: [{ translateX: lensLeft(geometry, from) + span / 2 }, { scaleX: 1 + span / geometry.lens.width }],
    };
  });

  const barContext = useMemo(
    () => ({ slide, trail, scrubbing, minimize, glyphOffsets: geometry.glyphOffsets }),
    [slide, trail, scrubbing, minimize, geometry.glyphOffsets],
  );

  const { frame, lens, pad } = geometry;
  // QUIRK(expo-glass-effect): the radius goes to UIKit's corner configuration as is, so the pill token's 9999 is wrong here.
  const capsule = { borderRadius: frame.height / 2 };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        {...props}
        style={[
          styles.capsule,
          glass ? styles.glassShadow : styles.solidShadow,
          { left: frame.left, right: frame.right, bottom: frame.bottom, height: frame.height },
          capsule,
          capsuleStyle,
          style,
        ]}
      >
        {/* WHY: no `overflow: 'hidden'` near the glass, which would clip its rim. */}
        {glass ? (
          <GlassView style={[StyleSheet.absoluteFill, styles.surface, capsule]} glassEffectStyle="regular" colorScheme={scheme} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.surface, styles.solidSurface, capsule]} />
        )}
        <Animated.View
          pointerEvents="none"
          style={[styles.lens, { top: lens.top, left: pad, width: lens.width, height: lens.height }, lensStyle]}
        />
        <View style={styles.row}>
          <BarContext.Provider value={barContext}>{children}</BarContext.Provider>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export type GlassTabButtonProps = TabTriggerSlotProps & {
  item: GlassTabItem;
  index: number;
  children?: ReactNode;
};

export function GlassTabButton({
  item,
  index,
  isFocused = false,
  disabled,
  onPress,
  // QUIRK(expo-router): the trigger's long press switches tabs with the finger down and drops the release's press,
  // so a slow re-tap did nothing and a hold then drag navigated twice.
  onLongPress: _onLongPress,
  children,
  ...props
}: GlassTabButtonProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const bar = use(BarContext);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: bar ? 1 - Math.min(Math.abs(bar.slide.get() - index), 1) : isFocused ? 1 : 0,
  }));

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (bar) {
        bar.slide.set(withSpring(index, SLIDE_SPRING));
        bar.trail.set(withSpring(index, TRAIL_SPRING));
        setMinimized(bar.minimize, 0);
      }
      onPress?.(event);
    },
    [bar, index, onPress],
  );

  const offset = bar?.glyphOffsets[index] ?? 0;

  return (
    <Pressable
      {...props}
      disabled={disabled ?? false}
      onPress={handlePress}
      feedback="none"
      style={styles.cell}
    >
      {/* QUIRK(ios): the shifted glyph reaches into the next cell, which iOS hit-tests first, so it takes no touch. */}
      <View pointerEvents="none" style={[styles.glyph, { transform: [{ translateX: offset }] }]}>
        <View style={styles.icon}>
          {item.renderIcon({ size: ICON_SIZE, color: color.fg.neutral, filled: false })}
          <Animated.View style={[StyleSheet.absoluteFill, styles.icon, fillStyle]}>
            {item.renderIcon({ size: ICON_SIZE, color: color.fg.neutral, filled: true })}
          </Animated.View>
          {children}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  capsule: {
    position: 'absolute',
    borderCurve: 'continuous',
  },
  // WHY: `boxShadow` alone; the token's old-style shadow props would rasterize the glass every frame of the scale.
  glassShadow: {
    boxShadow: SdsShadows.glassFloat.boxShadow,
  },
  solidShadow: {
    boxShadow: SdsShadows.level3.boxShadow,
    ...SdsShadows.level3.legacy,
  },
  surface: {
    borderCurve: 'continuous',
  },
  solidSurface: {
    backgroundColor: color.bg.layerDefault,
  },
  // EVIDENCE: `bg.neutralWeak` is the role nearest the native lens's measured luminance (244 to its 236 over white).
  lens: {
    position: 'absolute',
    borderRadius: SdsRadius.full,
    borderCurve: 'continuous',
    backgroundColor: color.bg.neutralWeak,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
  },
  glyph: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
