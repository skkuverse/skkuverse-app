import type { Insets, ShellConfig, Viewport } from '@skkuverse/miniapp/protocol';

export interface ViewportInput {
  shell: Pick<ShellConfig, 'bar' | 'header'>;
  insets: Insets;
  /** WHY: held still through a back swipe by `useSwipeGuard`; read only for `header: 'overlay'`. */
  headerHeight: number;
  /** WHY: only the part above the bottom safe area, which `insets.bottom` does not already count. */
  bottomBarHeight: number;
  glassAvailable: boolean;
}

// QUIRK(react-navigation): useHeaderHeight can report a bogus value before its layout settles.
const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

export function computeViewport({
  shell,
  insets,
  headerHeight,
  bottomBarHeight,
  glassAvailable,
}: ViewportInput): Viewport {
  const overlay = shell.header === 'overlay';
  const bottomBar = shell.bar === 'bottom';
  const top = nonNegative(insets.top);

  return {
    safeArea: {
      // WHY: under an opaque header the WebView never reaches the status bar.
      top: overlay ? top : 0,
      bottom: nonNegative(insets.bottom),
      left: nonNegative(insets.left),
      right: nonNegative(insets.right),
    },
    contentSafeArea: {
      // WHY: only the header below the status bar; safeArea.top already counts the rest.
      top: overlay ? nonNegative(headerHeight - top) : 0,
      bottom: bottomBar ? nonNegative(bottomBarHeight) : 0,
      left: 0,
      right: 0,
    },
    // WHY: glass matters only where chrome is drawn over the page; an opaque header with no
    // bottom bar covers nothing, whatever the OS offers.
    chrome: glassAvailable && (overlay || bottomBar) ? 'glass' : 'opaque',
  };
}
