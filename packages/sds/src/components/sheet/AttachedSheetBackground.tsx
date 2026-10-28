/**
 * WHY: the fill and the glass surfaces both follow the scheme SDS resolves (`useResolvedScheme()`), not the OS's 'auto',
 * so a sheet never turns half dark when dark mode switches on.
 */

import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { createThemedStyles } from '../../core/theme';
import { sheetCardShape } from './chrome';
import { useSheetMotion } from './useSheetMotion';

/**
 * WHY: replacing gorhom's `backgroundComponent` drops these unless they are re-declared, and a sheet silent to VoiceOver
 * is a regression no screenshot would catch.
 */
export const SHEET_BACKGROUND_A11Y = {
  accessible: true,
  accessibilityRole: 'adjustable',
  accessibilityLabel: 'Bottom Sheet',
} as const;

/** WHY: a sheet given an `accessibility` name speaks through its handle, so a second adjustable element behind the content would be noise. */
const SHEET_BACKGROUND_SILENT = { accessible: false, importantForAccessibility: 'no' } as const;

export function sheetBackgroundA11y(announces: boolean) {
  return announces ? SHEET_BACKGROUND_A11Y : SHEET_BACKGROUND_SILENT;
}

interface AttachedSheetBackgroundProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  announces?: boolean;
  lastIndex?: number;
  pageAtTop?: boolean;
}

export function AttachedSheetBackground({
  style,
  pointerEvents,
  announces = true,
  lastIndex = 0,
  pageAtTop = false,
}: AttachedSheetBackgroundProps) {
  const styles = useStyles();
  const { animatedIndex } = useSheetMotion();
  const corners = useAnimatedStyle(() => {
    const { top } = sheetCardShape('attached', animatedIndex.get(), lastIndex, pageAtTop, 0);
    return { borderTopLeftRadius: top, borderTopRightRadius: top };
  }, [lastIndex, pageAtTop]);
  return (
    <Animated.View
      {...sheetBackgroundA11y(announces)}
      pointerEvents={pointerEvents}
      style={[style, styles.attached, corners]}
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  attached: {
    backgroundColor: color.bg.layerFloating,
  },
}));
