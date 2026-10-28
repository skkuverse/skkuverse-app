import React, { type PropsWithChildren } from 'react';
import type { ColorModePolicy } from '../foundation/colorScheme';
import { ColorSchemeProvider } from './ColorSchemeProvider';
import { OverlayProvider } from './OverlayProvider';
import { TypographyProvider } from './TypographyProvider';

export interface SDSProviderProps {
  colorMode?: ColorModePolicy;
}

export function SDSProvider({ colorMode, children }: PropsWithChildren<SDSProviderProps>) {
  return (
    <ColorSchemeProvider colorMode={colorMode}>
      <TypographyProvider>
        <OverlayProvider>{children}</OverlayProvider>
      </TypographyProvider>
    </ColorSchemeProvider>
  );
}
