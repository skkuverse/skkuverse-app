// WHY: free of runtime react-native imports so vitest runs it; textStyles.ts binds it to Platform.OS.
import type { PlatformOSType } from 'react-native';
import { WANTED_SANS, type FontWeightValue } from './typography';

export type WantedSansFile = 'WantedSans-Regular' | 'WantedSans-Medium' | 'WantedSans-Bold';

export interface WantedSansFace {
  fontFamily: string;
  fontWeight: FontWeightValue;
}

/**
 * EVIDENCE: iOS draws semibold (600 = 0.30 UIFontWeight) with Medium (0.23), not Bold (0.40),
 * confirmed by glyph comparison on the simulator, so Android maps 600 to Medium too.
 */
const FILE_BY_WEIGHT: Record<FontWeightValue, WantedSansFile> = {
  '100': 'WantedSans-Regular',
  '200': 'WantedSans-Regular',
  '300': 'WantedSans-Regular',
  '400': 'WantedSans-Regular',
  '500': 'WantedSans-Medium',
  '600': 'WantedSans-Medium',
  '700': 'WantedSans-Bold',
  '800': 'WantedSans-Bold',
  '900': 'WantedSans-Bold',
};

/**
 * QUIRK(react-native): below weight 700 Android loads the file as named, with no faux bold; '400'
 * rather than 'normal' stays inside `FontWeightValue`.
 */
const ANDROID_FILE_WEIGHT: FontWeightValue = '400';

/**
 * QUIRK(react-native): iOS picks the family's nearest face by weight; Android loads
 * `assets/fonts/<fontFamily>[_bold].otf` (`_bold` from 700) and falls back silently to the system font.
 */
export function wantedSansFaceFor(os: PlatformOSType, weight: FontWeightValue): WantedSansFace {
  if (os !== 'android') return { fontFamily: WANTED_SANS, fontWeight: weight };
  return { fontFamily: FILE_BY_WEIGHT[weight], fontWeight: ANDROID_FILE_WEIGHT };
}

const BY_HUNDRED: readonly FontWeightValue[] = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

const NAMED_WEIGHTS: Record<string, FontWeightValue> = {
  ultralight: '100',
  thin: '200',
  light: '300',
  normal: '400',
  regular: '400',
  condensed: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  condensedBold: '700',
  heavy: '800',
  black: '900',
};

export function toFontWeightValue(weight: string | number | undefined): FontWeightValue {
  if (weight === undefined) return '400';
  const named = NAMED_WEIGHTS[String(weight)];
  if (named) return named;
  const step = Math.round(Number(weight) / 100) - 1;
  if (!Number.isFinite(step)) return '400';
  return BY_HUNDRED[Math.min(BY_HUNDRED.length - 1, Math.max(0, step))] ?? '400';
}

/**
 * WHY: only the logical family is resolved, since a file name has already lost the weight it was
 * chosen for.
 */
export function resolveWantedSansFace(
  os: PlatformOSType,
  style: { fontFamily?: string; fontWeight?: string | number },
): WantedSansFace | null {
  if (os !== 'android' || style.fontFamily !== WANTED_SANS) return null;
  return wantedSansFaceFor(os, toFontWeightValue(style.fontWeight));
}
