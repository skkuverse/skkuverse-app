import { useMemo } from 'react';
import type { NativeStackNavigationOptions } from 'expo-router';
import { useSemanticColors } from '@skkuverse/sds';
import { wantedSans } from '@skkuverse/shared';

/**
 * WHY: only the chevron's image is swapped, so UINavigationController keeps hiding it at a stack root, the
 * edge swipe, VoiceOver's "Back" and iOS 26's glass capsule. `scripts/export-header-icons.mjs` bakes the
 * PNG, which does not follow the tint.
 */
const ICON_BACK = require('../../assets/header-icons/caret-left.png');

export function useDefaultHeaderOptions(): NativeStackNavigationOptions {
  const color = useSemanticColors();
  return useMemo(
    () => ({
      headerTitleAlign: 'center',
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerTintColor: color.fg.neutral,
      headerStyle: { backgroundColor: color.bg.layerDefault },
      headerTitleStyle: wantedSans('700'),
      headerBackImageSource: ICON_BACK,
    }),
    [color],
  );
}
