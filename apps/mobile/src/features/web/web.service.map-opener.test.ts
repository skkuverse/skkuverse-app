/**
 * An SDUI `map` action that runs before bootstrap registered map's opener is a bug in the
 * entry, not a user path: it is reported once, in a release build too.
 */
import { describe, expect, it, vi } from 'vitest';

const crashlytics = vi.hoisted(() => ({ logHandledError: vi.fn() }));

vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@/platform/dev-log', () => ({ devLog: vi.fn() }));
vi.mock('@/platform/crashlytics', () => crashlytics);
// WHY: the hand-off wrappers load expo-web-browser, which Node cannot.
vi.mock('@/platform/handoff', () => ({ openExternalUrl: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));

describe('handleSduiAction map arm with no opener registered', () => {
  it('reports the missing opener as a handled error', async () => {
    // Arrange
    const { handleSduiAction } = await import('./web.service');

    // Act
    handleSduiAction({ actionType: 'map', actionValue: '21402', source: 'sdui' });

    // Assert
    expect(crashlytics.logHandledError).toHaveBeenCalledTimes(1);
    expect(crashlytics.logHandledError.mock.calls[0][0]).toBe('web/map-opener-missing');
  });
});
