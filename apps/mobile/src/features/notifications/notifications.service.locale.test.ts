/**
 * A change of app language reaches the signed-in user's document as the
 * notification locale, and a failed write is logged, never thrown. Only the
 * Firebase SDKs, App Check and the crash log are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logHandledError } from '@/platform/crashlytics';
import { syncUserLocale } from './notifications.service';

const sdk = vi.hoisted(() => ({
  uid: null as string | null,
  writes: [] as { path: string; data: unknown; options: unknown }[],
  fail: null as Error | null,
}));

vi.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: sdk.uid ? { uid: sdk.uid } : null }),
}));
vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: async (ref: { path: string }, data: unknown, options: unknown) => {
    if (sdk.fail) throw sdk.fail;
    sdk.writes.push({ path: ref.path, data, options });
  },
}));
vi.mock('@/platform/app-check', () => ({ primeAppCheck: async () => undefined }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn(), logBreadcrumb: vi.fn() }));

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sdk.uid = 'u1';
  sdk.writes.length = 0;
  sdk.fail = null;
  vi.mocked(logHandledError).mockClear();
});

describe('syncUserLocale', () => {
  it('merges the locale into the signed-in user document', async () => {
    // Act
    syncUserLocale('en');
    await flush();

    // Assert
    expect(sdk.writes).toStrictEqual([{ path: 'users/u1', data: { locale: 'en' }, options: { merge: true } }]);
  });

  it('writes nothing while signed out', async () => {
    // Arrange
    sdk.uid = null;

    // Act
    syncUserLocale('ko');
    await flush();

    // Assert
    expect(sdk.writes).toStrictEqual([]);
  });

  it('logs a failed write instead of throwing', async () => {
    // Arrange
    sdk.fail = new Error('offline');

    // Act
    syncUserLocale('ko');
    await flush();

    // Assert
    expect(logHandledError).toHaveBeenCalledWith('notifications/locale-sync', sdk.fail);
  });
});
