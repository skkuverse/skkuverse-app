/**
 * QUIRK(android): edge to edge, every sheet is attached and runs under three-button navigation, ~48dp of opaque bar that takes the taps.
 * iOS returns 0: a glass card floats above the home indicator and a solid sheet's padding was tuned against it. Content padding, not gorhom's
 * container: padding that box changes what `enableDynamicSizing` measures, and a `bottomInset` leaves a see-through strip.
 */

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useSheetBottomInset(): number {
  const { bottom } = useSafeAreaInsets();
  return Platform.OS === 'android' ? bottom : 0;
}
