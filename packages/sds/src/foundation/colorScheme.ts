/** WHY: colorScheme.test.mts loads this file under plain Node, so it imports types only. */
import type { ColorMode } from '@skkuverse/shared';

export type ColorModePolicy = 'system' | 'light-only' | 'dark-only';

export type SystemColorScheme = 'light' | 'dark' | 'unspecified' | null | undefined;

/** WHY: light until dark mode ships; turning it on also needs `userInterfaceStyle: "automatic"` in app.config.ts (a native change), or the OS reports light whatever the device says. */
export const DEFAULT_COLOR_MODE: ColorModePolicy = 'light-only';

export function resolveColorScheme(policy: ColorModePolicy, system: SystemColorScheme): ColorMode {
  switch (policy) {
    case 'light-only':
      return 'light';
    case 'dark-only':
      return 'dark';
    case 'system':
      return system === 'dark' ? 'dark' : 'light';
  }
}
