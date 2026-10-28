/**
 * On a uid transition this device's mini-app opt-ins are written again under
 * the new uid, each only after the device has moved, and each outcome is
 * logged as a re-apply. Every dependency outside the file is a double.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { errorCode, logPushSub, setMiniAppSubscribed } from './notifications.service';
import { registerCurrentDeviceForNotifications } from './useEnableNotificationsFlow';
import { reapplyMiniAppOptIns } from './useMiniAppPush';

vi.mock('expo-router/react-navigation', () => ({ useFocusEffect: vi.fn() }));
vi.mock('./useEnableNotificationsFlow', () => ({
  registerCurrentDeviceForNotifications: vi.fn(async () => undefined),
  useEnableNotificationsFlow: vi.fn(),
}));
vi.mock('./notifications.service', () => ({
  errorCode: vi.fn(() => 'code'),
  logPushSub: vi.fn(),
  requireNotificationSession: vi.fn(),
  retryForCurrentUid: (write: (uid: string) => Promise<void>) => write('u2'),
  setMiniAppSubscribed: vi.fn(),
}));
vi.mock('@/platform/messaging', () => ({ checkPermission: vi.fn() }));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));

const PUSHING = 'eskara-2026';
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T12:00:00+09:00'));
  vi.mocked(setMiniAppSubscribed).mockReset().mockResolvedValue(undefined);
  vi.mocked(logPushSub).mockClear();
  vi.mocked(logHandledError).mockClear();
  vi.mocked(registerCurrentDeviceForNotifications).mockClear();
  useSettingsStore.setState({ miniAppOptIns: [PUSHING] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reapplyMiniAppOptIns', () => {
  it('writes nothing until the device has moved', async () => {
    // Arrange
    let moved!: () => void;
    const deviceMoved = new Promise<void>((resolve) => (moved = resolve));

    // Act
    reapplyMiniAppOptIns('u1', 'u2', deviceMoved);
    await flush();

    // Assert
    expect(setMiniAppSubscribed).not.toHaveBeenCalled();
    moved();
    await flush();
    expect(setMiniAppSubscribed).toHaveBeenCalledWith('u2', PUSHING, true);
  });

  it('logs each re-apply and re-registers the device once the derive has run', async () => {
    // Act
    reapplyMiniAppOptIns('u1', 'u2', Promise.resolve());
    await flush();

    // Assert
    expect(logPushSub).toHaveBeenCalledWith({ miniapp_id: PUSHING, op: 'reapply', source: 'uid_change', result: 'ok' });
    expect(registerCurrentDeviceForNotifications).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(registerCurrentDeviceForNotifications).toHaveBeenCalledTimes(1);
  });

  it('logs a failed write as a re-apply failure', async () => {
    // Arrange
    const err = new Error('offline');
    vi.mocked(setMiniAppSubscribed).mockRejectedValue(err);

    // Act
    reapplyMiniAppOptIns('u1', 'u2', Promise.resolve());
    await flush();

    // Assert
    expect(errorCode).toHaveBeenCalledWith(err);
    expect(logPushSub).toHaveBeenCalledWith({
      miniapp_id: PUSHING,
      op: 'reapply',
      source: 'uid_change',
      result: 'fail',
      error: 'code',
    });
    expect(logHandledError).toHaveBeenCalledWith('miniapp-push/reapply', err);
  });

  it('re-applies nothing for the same uid, or once the push window has closed', async () => {
    // Act
    reapplyMiniAppOptIns('u2', 'u2', Promise.resolve());
    vi.setSystemTime(new Date('2026-10-03T00:00:00+09:00'));
    reapplyMiniAppOptIns('u1', 'u2', Promise.resolve());
    await flush();

    // Assert
    expect(setMiniAppSubscribed).not.toHaveBeenCalled();
  });
});
