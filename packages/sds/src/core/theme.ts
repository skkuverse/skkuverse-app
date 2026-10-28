/** WHY: a color read at module scope (`SdsSemanticColors.light.*`) never follows the scheme, so it stays light when dark mode turns on. */
import { StyleSheet } from 'react-native';
import { SdsSemanticColors, type ColorMode, type SemanticColors } from '@skkuverse/shared';
import { useResolvedScheme } from './ColorSchemeProvider';

export interface SdsTheme {
  readonly scheme: ColorMode;
  readonly color: SemanticColors;
}

export const sdsThemes: Readonly<Record<ColorMode, SdsTheme>> = {
  light: { scheme: 'light', color: SdsSemanticColors.light },
  dark: { scheme: 'dark', color: SdsSemanticColors.dark },
};
const themes = sdsThemes;

export function useSemanticColors(): SemanticColors {
  return themes[useResolvedScheme()].color;
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: SdsTheme) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const sheets: Readonly<Record<ColorMode, T>> = {
    light: StyleSheet.create(factory(themes.light)),
    dark: StyleSheet.create(factory(themes.dark)),
  };

  return function useThemedStyles(): T {
    return sheets[useResolvedScheme()];
  };
}
