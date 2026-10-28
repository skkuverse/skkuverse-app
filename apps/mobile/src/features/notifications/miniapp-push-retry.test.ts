/**
 * An accept an earlier launch never saw land (killed offline mid-flow, or
 * during the OS permission dialog) is written once a later launch is up and
 * signed in, but only with a real grant. Every dependency is injected.
 */
import { describe, expect, test, vi } from 'vitest';
import { createPendingOptInRetry } from './useMiniAppPush';
import { pendingOptInRetries } from './miniapp-push.rules';

// vi.mock calls are hoisted above the imports.

vi.mock('expo-router/react-navigation', () => ({ useFocusEffect: vi.fn() }));
vi.mock('./useEnableNotificationsFlow', () => ({
  registerCurrentDeviceForNotifications: vi.fn(),
  useEnableNotificationsFlow: vi.fn(),
}));
vi.mock('@/features/notifications/notifications.service', () => ({
  errorCode: vi.fn(),
  logPushSub: vi.fn(),
  setMiniAppSubscribed: vi.fn(),
}));
vi.mock('@/platform/messaging', () => ({ checkPermission: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));

const PUSHING = 'eskara-2026';

function deps(overrides: Partial<Parameters<typeof createPendingOptInRetry>[0]> = {}) {
  return {
    uid: () => 'u1' as string | null,
    pending: () => [PUSHING],
    due: (ids: readonly string[]) => [...ids],
    checkPermission: async () => 'authorized' as const,
    write: vi.fn(),
    clearPending: vi.fn(),
    logDenied: vi.fn(),
    ...overrides,
  };
}

describe('pendingOptInRetries', () => {
  test('a grant writes every due accept', () => {
    expect(pendingOptInRetries(['a', 'b'], true)).toStrictEqual({ write: ['a', 'b'], deny: [] });
  });

  test('no grant clears every due accept instead', () => {
    expect(pendingOptInRetries(['a'], false)).toStrictEqual({ write: [], deny: ['a'] });
  });
});

describe('createPendingOptInRetry', () => {
  test('signed in with a grant, a pending accept is written as a retry', async () => {
    const d = deps();
    await createPendingOptInRetry(d)();
    expect(d.write).toHaveBeenCalledWith(PUSHING, true, 'retry');
    expect(d.clearPending).not.toHaveBeenCalled();
  });

  test('provisional counts as a grant', async () => {
    const d = deps({ checkPermission: async () => 'provisional' as const });
    await createPendingOptInRetry(d)();
    expect(d.write).toHaveBeenCalledWith(PUSHING, true, 'retry');
  });

  test('without a grant the pending flag is cleared and the denial logged', async () => {
    const d = deps({ checkPermission: async () => 'denied' as const });
    await createPendingOptInRetry(d)();
    expect(d.write).not.toHaveBeenCalled();
    expect(d.clearPending).toHaveBeenCalledWith(PUSHING);
    expect(d.logDenied).toHaveBeenCalledWith(PUSHING);
  });

  test('signed out, nothing runs and a later signed-in call still retries', async () => {
    let uid: string | null = null;
    const d = deps({ uid: () => uid });
    const retry = createPendingOptInRetry(d);
    await retry();
    expect(d.write).not.toHaveBeenCalled();
    uid = 'u1';
    await retry();
    expect(d.write).toHaveBeenCalledTimes(1);
  });

  test('once per launch: a second call writes nothing', async () => {
    const d = deps();
    const retry = createPendingOptInRetry(d);
    await retry();
    await retry();
    expect(d.write).toHaveBeenCalledTimes(1);
  });

  test('nothing due, the permission is not read', async () => {
    const checkPermission = vi.fn(async () => 'authorized' as const);
    const d = deps({ due: () => [], checkPermission });
    await createPendingOptInRetry(d)();
    expect(checkPermission).not.toHaveBeenCalled();
    expect(d.write).not.toHaveBeenCalled();
  });
});
