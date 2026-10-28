import React, { createContext, useContext, type PropsWithChildren } from 'react';
// eslint-disable-next-line no-restricted-imports -- the one place allowed to ask the OS for its scheme; everything else reads useResolvedScheme()
import { useColorScheme } from 'react-native';
import type { ColorMode } from '@skkuverse/shared';
import {
  DEFAULT_COLOR_MODE,
  resolveColorScheme,
  type ColorModePolicy,
} from '../foundation/colorScheme';

const ColorSchemeContext = createContext<ColorMode>('light');

export interface ColorSchemeProviderProps {
  colorMode?: ColorModePolicy;
}

export function ColorSchemeProvider({
  colorMode = DEFAULT_COLOR_MODE,
  children,
}: PropsWithChildren<ColorSchemeProviderProps>) {
  const system = useColorScheme();
  const scheme = resolveColorScheme(colorMode, system);

  return <ColorSchemeContext.Provider value={scheme}>{children}</ColorSchemeContext.Provider>;
}

/** WHY: read this, never React Native's `useColorScheme()`, which knows neither the app's policy nor a subtree's override. */
export function useResolvedScheme(): ColorMode {
  return useContext(ColorSchemeContext);
}
