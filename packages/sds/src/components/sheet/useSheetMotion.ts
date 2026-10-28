/**
 * SEE: docs/explanation/bottom-sheet-system.md ("Read gorhom's position, not the copy"): a style reading the caller's copies lagged on 46% of drag frames, up to 153pt on a flick.
 * QUIRK(gorhom-bottom-sheet): callable only below the sheet, where gorhom's internal provider resolves.
 */

import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import type { SharedValue } from 'react-native-reanimated';

export interface SheetMotion {
  animatedPosition: SharedValue<number>;
  animatedIndex: SharedValue<number>;
}

export function useSheetMotion(): SheetMotion {
  const { animatedPosition, animatedIndex } = useBottomSheetInternal();
  return { animatedPosition, animatedIndex };
}
