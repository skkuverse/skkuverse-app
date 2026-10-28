/**
 * QUIRK(ios): opacity 0 on a GlassView or any ancestor stops it rendering, so an opaque layer fades in over full-opacity glass
 * and the frame carrying the card never takes an animated opacity. SEE: docs/explanation/bottom-sheet-system.md ("Glass cannot be faded out, only covered")
 */

import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { useResolvedScheme } from '../../core/ColorSchemeProvider';
import { createThemedStyles } from '../../core/theme';
import { GLASS_AVAILABLE, glassFloatShadow } from '../glass';
import { fillAt, sheetCardShape, sheetChromeAt, SHEET_FLOAT_INSET } from './chrome';
import { AttachedSheetBackground, sheetBackgroundA11y } from './AttachedSheetBackground';
import { useSheetMotion } from './useSheetMotion';

/** WHY: animated, so the radii reach the native `cornerConfiguration` every frame. */
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

/** WHY: per-corner radii, because the bottom two stay concentric with the display's own corner; `expo-glass-effect` takes each as a native prop. */
function corners({ top, bottom }: { top: number; bottom: number }) {
  'worklet';
  return {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
}

interface ExpandableSheetBackgroundProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  lastIndex: number;
  /**
   * SEE: docs/explanation/bottom-sheet-system.md ("The bottom gap is not the side gap"): a modal's container is the whole window,
   * so lining up with an inline card takes a larger gap than `SHEET_FLOAT_INSET`.
   */
  floatBottomGap?: number;
  announces?: boolean;
  pageAtTop?: boolean;
  fillByIndex?: readonly number[] | null;
}

export function ExpandableSheetBackground({
  style,
  pointerEvents,
  lastIndex,
  floatBottomGap = SHEET_FLOAT_INSET,
  announces = true,
  pageAtTop = false,
  fillByIndex = null,
}: ExpandableSheetBackgroundProps) {
  const styles = useStyles();
  const scheme = useResolvedScheme();
  // WHY: the container gorhom resolves its percentage detents against, read here rather than passed in, so the card and the detents measure one box.
  const { animatedLayoutState } = useBottomSheetInternal();
  // SEE: docs/explanation/bottom-sheet-system.md ("Read gorhom's position, not the copy"): the computed bottom edge shakes unless it reads the frame the translate does.
  const { animatedIndex, animatedPosition } = useSheetMotion();
  const [measured, setMeasured] = useState(false);

  // QUIRK(gorhom-bottom-sheet): the container height is 0 before the first layout, so this flips once on mount rather than costing anything per frame.
  useAnimatedReaction(
    () => animatedLayoutState.get().containerHeight > 0,
    (isMeasured, wasMeasured) => {
      if (isMeasured !== wasMeasured) {
        runOnJS(setMeasured)(isMeasured);
      }
    },
    [],
  );

  // QUIRK(gorhom-bottom-sheet): the body is as tall as the top detent and moved by a translate, so a `bottom` inset lands off-screen
  // below the top; the card's bottom is a height back from the container. Positioned from scratch, not by spreading absoluteFill:
  // `bottom: 0` plus an explicit `height` is over-constrained, and which one Yoga drops is not a thing to leave to chance.
  const cardStyle = useAnimatedStyle(() => {
    const shape = sheetCardShape('travelling', animatedIndex.get(), lastIndex, pageAtTop, floatBottomGap);
    const containerHeight = animatedLayoutState.get().containerHeight;
    return {
      height: Math.max(containerHeight - (shape.gap ?? 0) - animatedPosition.get(), 0),
      ...corners(shape),
    };
  }, [lastIndex, floatBottomGap, pageAtTop]);

  const glassStyle = useAnimatedStyle(
    () => corners(sheetCardShape('travelling', animatedIndex.get(), lastIndex, pageAtTop, floatBottomGap)),
    [lastIndex, floatBottomGap, pageAtTop],
  );

  const fillStyle = useAnimatedStyle(() => {
    const index = animatedIndex.get();
    const { fillOpacity } = sheetChromeAt(index, lastIndex, pageAtTop);
    return {
      ...corners(sheetCardShape('travelling', index, lastIndex, pageAtTop, floatBottomGap)),
      opacity: fillByIndex ? fillAt(index, fillByIndex) : fillOpacity,
    };
  }, [lastIndex, floatBottomGap, pageAtTop, fillByIndex]);

  if (!GLASS_AVAILABLE || !measured) {
    return (
      <AttachedSheetBackground
        style={style}
        pointerEvents={pointerEvents}
        announces={announces}
        lastIndex={lastIndex}
        pageAtTop={pageAtTop}
      />
    );
  }

  return (
    <Animated.View
      {...sheetBackgroundA11y(announces)}
      pointerEvents={pointerEvents}
      style={[styles.card, cardStyle]}
    >
      <AnimatedGlassView
        style={[StyleSheet.absoluteFill, glassStyle]}
        glassEffectStyle="regular"
        // WHY: the scheme SDS resolves, not 'auto', which follows the system and would diverge from every other surface on the screen.
        colorScheme={scheme}
      />
      <Animated.View style={[styles.fill, fillStyle]} />
    </Animated.View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // WHY: `boxShadow` is cast from the border metrics, so the frame carries a radius it never paints; `overflow: 'hidden'` would mask the shadow away.
    overflow: 'visible',
    ...glassFloatShadow,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.bg.layerFloating,
    // QUIRK(ios): UIKit draws the glass with a continuous corner, so the frame matches it.
    borderCurve: 'continuous',
  },
}));
