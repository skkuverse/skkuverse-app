/**
 * The `notif_perm` user property follows the permission status its caller
 * read from the OS, and is sent only when it changed. Only the Firebase SDKs
 * and the release context are doubles.
 */
import { describe, expect, it, vi } from 'vitest';
import { syncNotificationPermission } from './analytics';

const firebase = vi.hoisted(() => ({ setUserProperty: vi.fn(() => Promise.resolve()) }));

vi.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => ({}),
  logEvent: vi.fn(() => Promise.resolve()),
  logScreenView: vi.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: vi.fn(() => Promise.resolve()),
  setDefaultEventParameters: vi.fn(() => Promise.resolve()),
  setUserId: vi.fn(() => Promise.resolve()),
  setUserProperty: firebase.setUserProperty,
}));
vi.mock('@react-native-firebase/crashlytics', () => ({ getCrashlytics: () => ({}), log: vi.fn() }));
vi.mock('./ota', () => ({ releaseContext: () => ({}) }));

const notifPermCalls = () =>
  firebase.setUserProperty.mock.calls.filter((call: unknown[]) => call[1] === 'notif_perm').map((call: unknown[]) => call[2]);

describe('syncNotificationPermission', () => {
  it('sends the status it is given, once per change', async () => {
    // Act
    syncNotificationPermission('authorized');
    syncNotificationPermission('authorized');
    syncNotificationPermission('denied');
    await Promise.resolve();

    // Assert
    expect(notifPermCalls()).toEqual(['granted', 'denied']);
  });
});
