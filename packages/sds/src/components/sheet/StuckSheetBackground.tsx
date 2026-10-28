/**
 * SEE: docs/explanation/bottom-sheet-system.md ("The rule that decides the surface"): a card that keeps one shape needs no measurement or crossfade.
 * QUIRK(gorhom-bottom-sheet): under `detached` with a `bottomInset` the body's box is exactly the visible card, with `overflow: 'visible'`,
 * so filling gorhom's `absoluteFill` is the whole job.
 */

import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import { useResolvedScheme } from '../../core/ColorSchemeProvider';
import { createThemedStyles } from '../../core/theme';
import { GLASS_AVAILABLE, glassFloatShadow } from '../glass';
import { fillAt, sheetCardShape } from './chrome';
import { AttachedSheetBackground, sheetBackgroundA11y } from './AttachedSheetBackground';
import { useSheetMotion } from './useSheetMotion';

interface StuckSheetBackgroundProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  bottomGap: number;
  announces?: boolean;
  fillByIndex?: readonly number[] | null;
}

export function StuckSheetBackground({
  style,
  pointerEvents,
  bottomGap,
  announces = true,
  fillByIndex = null,
}: StuckSheetBackgroundProps) {
  const scheme = useResolvedScheme();
  // WHY: its host leaves `detached` off in the same branch, so the two agree.
  if (!GLASS_AVAILABLE) {
    return <AttachedSheetBackground style={style} pointerEvents={pointerEvents} announces={announces} />;
  }

  /** WHY: the bottom corners stay concentric with the display's, or the OS mask slices them off; `bottomCornerRadius` gives the expandable card the same answer. */
  const shape = sheetCardShape('floating', 0, 0, false, bottomGap);
  const corners = {
    borderTopLeftRadius: shape.top,
    borderTopRightRadius: shape.top,
    borderBottomLeftRadius: shape.bottom,
    borderBottomRightRadius: shape.bottom,
  };

  return (
    <View
      {...sheetBackgroundA11y(announces)}
      pointerEvents={pointerEvents}
      style={[style, styles.card, corners]}
    >
      <GlassView
        style={[StyleSheet.absoluteFill, corners]}
        glassEffectStyle="regular"
        // WHY: the scheme SDS resolves, not 'auto', which follows the system and would diverge from every other surface on the screen.
        colorScheme={scheme}
      />
      {fillByIndex ? <ScheduledFill fillByIndex={fillByIndex} corners={corners} /> : null}
    </View>
  );
}

/** QUIRK(ios): a GlassView under any opacity stops rendering, so the glass stays at full opacity and this opaque layer fades over it. */
function ScheduledFill({
  fillByIndex,
  corners,
}: {
  fillByIndex: readonly number[];
  corners: ViewStyle;
}) {
  const themed = useThemedStyles();
  const { animatedIndex } = useSheetMotion();
  const fade = useAnimatedStyle(() => ({ opacity: fillAt(animatedIndex.get(), fillByIndex) }), [fillByIndex]);
  return <Animated.View pointerEvents="none" style={[themed.fill, corners, fade]} />;
}

const useThemedStyles = createThemedStyles(({ color }) => ({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.bg.layerFloating,
    // QUIRK(ios): UIKit draws the glass with a continuous corner, so the frame matches it.
    borderCurve: 'continuous',
  },
}));

const styles = StyleSheet.create({
  card: {
    // WHY: `boxShadow` is cast from the border metrics, so the frame carries a radius it never paints; `overflow: 'hidden'` would mask the shadow away.
    overflow: 'visible',
    ...glassFloatShadow,
  },
});
