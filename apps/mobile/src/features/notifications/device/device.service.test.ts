/**
 * This device's record under whoever is signed in: at launch, on a token
 * refresh and on a uid transition. The uid is read per attempt, so a retry
 * that lands after the uid changed writes the new one. Only the Firebase SDKs,
 * messaging, App Check and the device id are doubles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStore, useSettingsStore } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { getDeviceToken, requestPermission } from '@/platform/messaging';
import { moveDeviceToCurrentUid, registerPushAtLaunch, registerRefreshedToken } from './device.service';

const sdk = vi.hoisted(() => ({
  uid: null as string | null,
  docs: new Map<string, Record<string, unknown>>(),
  deviceWrites: [] as { path: string; data: Record<string, unknown> }[],
}));

vi.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: sdk.uid ? { uid: sdk.uid } : null }),
}));
vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: async (ref: { path: string }) => ({
    exists: () => sdk.docs.has(ref.path),
    data: () => sdk.docs.get(ref.path),
  }),
  setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    if (ref.path.startsWith('devices/')) sdk.deviceWrites.push({ path: ref.path, data });
    sdk.docs.set(ref.path, { ...sdk.docs.get(ref.path), ...data });
  },
  updateDoc: async () => undefined,
  onSnapshot: () => () => undefined,
  serverTimestamp: () => 'server-ts',
  arrayUnion: (value: string) => value,
  arrayRemove: (value: string) => value,
}));
vi.mock('@/platform/app-check', () => ({ primeAppCheck: async () => undefined }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn(), logBreadcrumb: vi.fn() }));
vi.mock('@/platform/device-id', () => ({ getOrCreateDeviceId: () => 'dev1' }));
vi.mock('@/platform/messaging', () => ({
  requestPermission: vi.fn(),
  ensureRegistered: vi.fn(async () => undefined),
  getDeviceToken: vi.fn(),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sdk.uid = 'u1';
  sdk.docs.clear();
  sdk.deviceWrites.length = 0;
  vi.mocked(logHandledError).mockClear();
  vi.mocked(requestPermission).mockReset();
  vi.mocked(getDeviceToken).mockReset();
  useNotificationStore.setState({
    fcmToken: null,
    deviceId: null,
    isTokenRegistered: false,
    permissionStatus: 'authorized',
  });
  useSettingsStore.setState({ onboardingCompleted: true, miniAppOptIns: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('registerPushAtLaunch', () => {
  it('never asks a device that was never asked', async () => {
    // Arrange
    useNotificationStore.setState({ permissionStatus: 'notDetermined' });

    // Act
    await registerPushAtLaunch('dev1', 'ko');

    // Assert
    expect(requestPermission).not.toHaveBeenCalled();
    expect(sdk.deviceWrites).toStrictEqual([]);
  });

  it('registers a granted device under the signed-in uid and marks the token registered', async () => {
    // Arrange
    vi.mocked(requestPermission).mockResolvedValue('authorized');
    vi.mocked(getDeviceToken).mockResolvedValue('tok');

    // Act
    await registerPushAtLaunch('dev1', 'en');

    // Assert
    expect(sdk.deviceWrites).toHaveLength(1);
    expect(sdk.deviceWrites[0]).toMatchObject({
      path: 'devices/dev1',
      data: { uid: 'u1', token: 'tok', platform: 'ios', appVersion: '0.0.0-test', active: true, locale: 'en' },
    });
    expect(useNotificationStore.getState()).toMatchObject({ fcmToken: 'tok', isTokenRegistered: true });
  });

  it('stores a refusal and registers nothing', async () => {
    // Arrange
    vi.mocked(requestPermission).mockResolvedValue('denied');

    // Act
    await registerPushAtLaunch('dev1', 'ko');

    // Assert
    expect(useNotificationStore.getState().permissionStatus).toBe('denied');
    expect(getDeviceToken).not.toHaveBeenCalled();
    expect(sdk.deviceWrites).toStrictEqual([]);
  });
});

describe('registerRefreshedToken', () => {
  it('keeps the token and registers nothing while the device has no id', async () => {
    // Act
    registerRefreshedToken('tok2', 'ko');
    await flush();

    // Assert
    expect(useNotificationStore.getState().fcmToken).toBe('tok2');
    expect(sdk.deviceWrites).toStrictEqual([]);
  });

  it('registers the new token under the signed-in uid once the device has an id', async () => {
    // Arrange
    useNotificationStore.setState({ deviceId: 'dev1' });

    // Act
    registerRefreshedToken('tok2', 'ko');
    await vi.waitFor(() => expect(useNotificationStore.getState().isTokenRegistered).toBe(true));

    // Assert
    expect(sdk.deviceWrites[0]).toMatchObject({ path: 'devices/dev1', data: { uid: 'u1', token: 'tok2', locale: 'ko' } });
  });
});

describe('moveDeviceToCurrentUid', () => {
  it('settles at once when there is no token, so no device is moved', async () => {
    // Act
    await moveDeviceToCurrentUid('ko');

    // Assert
    expect(sdk.deviceWrites).toStrictEqual([]);
  });

  it('reads the uid per attempt, so a retry after the sign-in lands writes the new uid', async () => {
    // Arrange
    vi.useFakeTimers();
    useNotificationStore.setState({ fcmToken: 'tok' });
    sdk.uid = null;

    // Act
    const moved = moveDeviceToCurrentUid('ko');
    sdk.uid = 'u2';
    await vi.runAllTimersAsync();
    await moved;

    // Assert
    expect(sdk.deviceWrites).toHaveLength(1);
    expect(sdk.deviceWrites[0]).toMatchObject({ path: 'devices/dev1', data: { uid: 'u2', token: 'tok' } });
    expect(logHandledError).not.toHaveBeenCalled();
  });

  it('logs a move that never finds a signed-in user, and still settles', async () => {
    // Arrange
    vi.useFakeTimers();
    useNotificationStore.setState({ fcmToken: 'tok' });
    sdk.uid = null;

    // Act
    const moved = moveDeviceToCurrentUid('ko');
    await vi.runAllTimersAsync();
    await moved;

    // Assert
    expect(sdk.deviceWrites).toStrictEqual([]);
    expect(logHandledError).toHaveBeenCalledWith('notifications/auth-transition', expect.any(Error));
  });
});
