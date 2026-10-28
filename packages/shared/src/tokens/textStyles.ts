/**
 * WHY: typography.ts is copied byte for byte into the web repos and imports nothing, so this resolves
 * its `SdsTypo` per platform; the export keeps the name so lint selectors keyed on it still apply.
 */
import { Platform } from 'react-native';
import { wantedSansFaceFor, type WantedSansFace } from './fontFace';
import { SdsTypo as neutralTypo, type FontWeightValue, type SdsTextStyle } from './typography';

export function wantedSans(weight: FontWeightValue): WantedSansFace {
  return wantedSansFaceFor(Platform.OS, weight);
}

export const SdsTypo = Object.fromEntries(
  Object.entries(neutralTypo).map(([name, style]) => [name, { ...style, ...wantedSans(style.fontWeight) }]),
) as { readonly [K in keyof typeof neutralTypo]: SdsTextStyle };
