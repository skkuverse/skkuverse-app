import { describe, expect, test, vi } from 'vitest';
import { HANDOFF_WINDOW_MS } from './handoff.rules';
import { markHandoff, takeHandoff } from './handoff';

// Only the mark is under test; the native modules the wrappers reach are doubles.
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));
vi.mock('expo-application', () => ({ applicationId: 'test' }));
vi.mock('./crashlytics', () => ({ logHandledError: vi.fn() }));

describe('takeHandoff', () => {
  test('tags one return, then the mark is gone', () => {
    markHandoff('share', 10_000);
    expect(takeHandoff(10_200)).toBe('share');
    expect(takeHandoff(10_300)).toBe(undefined);
  });

  test('a stale mark is cleared without tagging, so it cannot tag a later departure', () => {
    markHandoff('browser', 20_000);
    expect(takeHandoff(20_001 + HANDOFF_WINDOW_MS)).toBe(undefined);
    markHandoff('browser', 30_000);
    takeHandoff(99_000);
    expect(takeHandoff(30_100)).toBe(undefined);
  });

  test('the latest mark wins', () => {
    markHandoff('permission', 40_000);
    markHandoff('settings', 40_100);
    expect(takeHandoff(40_300)).toBe('settings');
  });
});
