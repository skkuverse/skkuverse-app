import { Platform } from 'react-native';
import type { ReactNode } from 'react';
import { KeyboardProvider as KeyboardControllerProvider } from 'react-native-keyboard-controller';

/**
 * QUIRK(react-native-keyboard-controller): enabled on Android it drops `adjustResize` app-wide, which the
 * feedback sheets and search screens rely on, so it mounts on iOS only.
 */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return children;
  // EVIDENCE: without `preload` the first keyboard of a launch (onboarding's) jumped the CTA instead of animating it, iOS 26.5 sim.
  return <KeyboardControllerProvider preload>{children}</KeyboardControllerProvider>;
}
