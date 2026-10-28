import { expect, test } from 'vitest';
import { RESTORE_MIN_OFFSET, scrollToRestore, stableHeaderHeight } from './swipe-guard.rules';

test('header height follows reports outside a transition', () => {
  expect(stableHeaderHeight(0, 116, false)).toBe(116);
  expect(stableHeaderHeight(116, 108, false)).toBe(108);
});

test('header height holds still during a transition', () => {
  expect(stableHeaderHeight(116, 0, true)).toBe(116);
  expect(stableHeaderHeight(116, 62, true)).toBe(116);
});

test('a hidden bar (height 0) never replaces a real header height', () => {
  expect(stableHeaderHeight(116, 0, false)).toBe(116);
  expect(stableHeaderHeight(116, Number.NaN, false)).toBe(116);
});

test('the first report is taken even mid-transition', () => {
  expect(stableHeaderHeight(0, 116, true)).toBe(116);
  expect(stableHeaderHeight(0, 0, true)).toBe(0);
});

test('a page thrown back to the top is restored', () => {
  expect(scrollToRestore(1200, 0)).toBe(1200);
  expect(scrollToRestore(800.4, 10)).toBe(800);
});

test('a page that stayed put, or was near the top, is left alone', () => {
  expect(scrollToRestore(1200, 1200)).toBe(null);
  expect(scrollToRestore(1200, 700)).toBe(null);
  expect(scrollToRestore(RESTORE_MIN_OFFSET - 1, 0)).toBe(null);
  expect(scrollToRestore(Number.NaN, 0)).toBe(null);
});
