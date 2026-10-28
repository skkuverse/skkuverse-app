import { expect, test } from 'vitest';
import type { ShellBar, ShellHeader } from '@skkuverse/miniapp/protocol';
import { computeViewport } from './viewport.rules';

// EVIDENCE: an iPhone with a Dynamic Island, portrait: 62 status bar, 34 home indicator,
// a 116 header (status bar included) and a 62 floating bar above the indicator.
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 };
const BASE = { insets: INSETS, headerHeight: 116, bottomBarHeight: 62 };

const HEADERS: ShellHeader[] = ['opaque', 'overlay'];
const BARS: ShellBar[] = ['top', 'bottom', 'none'];

for (const header of HEADERS) {
  for (const bar of BARS) {
    for (const glassAvailable of [true, false]) {
      test(`header ${header} × bar ${bar} × ${glassAvailable ? 'glass' : 'no glass'}`, () => {
        const vp = computeViewport({ ...BASE, shell: { header, bar }, glassAvailable });

        // WHY: under an opaque header the WebView starts below it, so nothing covers its top;
        // under an overlay one it starts at y = 0.
        if (header === 'opaque') {
          expect(vp.safeArea.top).toBe(0);
          expect(vp.contentSafeArea.top).toBe(0);
        } else {
          expect(vp.safeArea.top).toBe(62);
          expect(vp.contentSafeArea.top).toBe(116 - 62);
        }

        // WHY: the WebView always reaches the bottom edge, so the home indicator is always
        // the page's to avoid; only the floating bar adds to it.
        expect(vp.safeArea.bottom).toBe(34);
        expect(vp.contentSafeArea.bottom).toBe(bar === 'bottom' ? 62 : 0);

        const drawnOver = header === 'overlay' || bar === 'bottom';
        expect(vp.chrome).toBe(glassAvailable && drawnOver ? 'glass' : 'opaque');
      });
    }
  }
}

test('left and right come from the device insets (landscape), never the chrome', () => {
  const vp = computeViewport({
    ...BASE,
    insets: { top: 0, bottom: 21, left: 59, right: 59 },
    shell: { header: 'overlay', bar: 'bottom' },
    glassAvailable: true,
  });
  expect([vp.safeArea.left, vp.safeArea.right]).toStrictEqual([59, 59]);
  expect([vp.contentSafeArea.left, vp.contentSafeArea.right]).toStrictEqual([0, 0]);
});

test('never reports a negative or non-finite inset', () => {
  // QUIRK(rnscreens): before the header lays out, useHeaderHeight can read below the status bar.
  const vp = computeViewport({
    shell: { header: 'overlay', bar: 'bottom' },
    insets: { top: 62, bottom: Number.NaN, left: -1, right: 0 },
    headerHeight: 0,
    bottomBarHeight: -5,
    glassAvailable: false,
  });
  expect(vp.contentSafeArea.top).toBe(0);
  expect(vp.contentSafeArea.bottom).toBe(0);
  expect(vp.safeArea.bottom).toBe(0);
  expect(vp.safeArea.left).toBe(0);
});

test('rounds fractional insets to whole CSS pixels', () => {
  const vp = computeViewport({
    shell: { header: 'overlay', bar: 'top' },
    insets: { top: 47.33, bottom: 34, left: 0, right: 0 },
    headerHeight: 91.67,
    bottomBarHeight: 0,
    glassAvailable: false,
  });
  expect(vp.safeArea.top).toBe(47);
  // WHY: what the page pads with, the sum, is the header's own rounded height.
  expect(vp.safeArea.top + vp.contentSafeArea.top).toBe(92);
});
