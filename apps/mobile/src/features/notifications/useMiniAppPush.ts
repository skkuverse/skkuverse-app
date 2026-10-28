import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { authStore, useAuthStore, useNotificationStore, useSettingsStore, useT } from '@skkuverse/shared';
import type { SessionBlocked } from '@/features/auth/auth.types';
import {
  registerCurrentDeviceForNotifications,
  useEnableNotificationsFlow,
} from './useEnableNotificationsFlow';
import {
  errorCode,
  logPushSub,
  requireNotificationSession,
  retryForCurrentUid,
  setMiniAppSubscribed,
} from '@/features/notifications/notifications.service';
import { checkPermission } from '@/platform/messaging';
import { isMiniAppPushOn, optInsToReapply, pendingOptInRetries } from './miniapp-push.rules';
import { activeMiniAppOptIns } from './notifications.constants';
import { logHandledError } from '@/platform/crashlytics';

type Source = 'feed' | 'toggle' | 'uid_change' | 'retry';

/**
 * WHY: a subscription write may take effect out of order with an earlier one, so once earlier writes
 * have settled the device re-registers to re-assert its current choice. It also re-activates a device
 * record a sign-in or sign-out deactivated.
 */
const REPLICA_HEAL_DELAY_MS = 15_000;

// WHY: module scope: the toggle's screen often closes within seconds, and unmounting must not cancel the heal.
let healTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleReplicaHeal(): void {
  if (healTimer) clearTimeout(healTimer);
  healTimer = setTimeout(() => {
    healTimer = null;
    registerCurrentDeviceForNotifications().catch((err) =>
      logHandledError('miniapp-push/replica-heal', err),
    );
  }, REPLICA_HEAL_DELAY_MS);
}

/**
 * WHY: callers do not await it: a write settles on server ack, which never comes in a dead spot; the
 * mutation applies locally and the pending flag covers a kill before the flush.
 */
export function writeMiniAppSubscription(
  miniAppId: string,
  on: boolean,
  source: Source,
  onDone?: (ok: boolean, blocked?: SessionBlocked) => void,
): void {
  const op = on ? 'on' : 'off';
  const session = requireNotificationSession();
  if ('reason' in session) {
    logPushSub({ miniapp_id: miniAppId, op, source, result: 'fail', error: 'no_uid' });
    onDone?.(false, session);
    return;
  }
  const { uid } = session;
  const settings = useSettingsStore.getState();
  // WHY: the device's record first, so a uid change mid-write still carries the choice (optInsToReapply).
  settings.setMiniAppOptIn(miniAppId, on);
  settings.setMiniAppOptInPending(miniAppId, on);

  setMiniAppSubscribed(uid, miniAppId, on)
    .then(() => {
      useSettingsStore.getState().setMiniAppOptInPending(miniAppId, false);
      // WHY: a write with no registered token reaches nobody on this device yet, so the trace says so.
      const registered = useNotificationStore.getState().isTokenRegistered;
      logPushSub({
        miniapp_id: miniAppId,
        op,
        source,
        result: 'ok',
        ...(on && !registered ? { error: 'no_device' } : {}),
      });
      if (on) scheduleReplicaHeal();
      onDone?.(true);
    })
    .catch((err) => {
      logPushSub({ miniapp_id: miniAppId, op, source, result: 'fail', error: errorCode(err) });
      logHandledError(`miniapp-push/${op}`, err);
      onDone?.(false);
    });
}

/**
 * WHY: opt-ins follow the device, since a uid change leaves the old preferences document behind. Each
 * re-apply waits for `deviceMoved`, since an opt-in reaches a device only once it is registered to this uid.
 */
export function reapplyMiniAppOptIns(prevUid: string, uid: string, deviceMoved: Promise<void>): void {
  const reapply = optInsToReapply({
    prevUid,
    uid,
    optIns: activeMiniAppOptIns(useSettingsStore.getState().miniAppOptIns, Date.now()),
  });
  for (const miniAppId of reapply) {
    void deviceMoved.then(() => retryForCurrentUid((currentUid) => setMiniAppSubscribed(currentUid, miniAppId, true)))
      .then(() => {
        logPushSub({ miniapp_id: miniAppId, op: 'reapply', source: 'uid_change', result: 'ok' });
        scheduleReplicaHeal();
      })
      .catch((err) => {
        logPushSub({
          miniapp_id: miniAppId,
          op: 'reapply',
          source: 'uid_change',
          result: 'fail',
          error: errorCode(err),
        });
        logHandledError('miniapp-push/reapply', err);
      });
  }
}

type PermissionAnswer = Awaited<ReturnType<typeof checkPermission>>;

interface PendingOptInRetryDeps {
  uid: () => string | null;
  pending: () => readonly string[];
  due: (pending: readonly string[]) => string[];
  checkPermission: () => Promise<PermissionAnswer>;
  write: typeof writeMiniAppSubscription;
  clearPending: (miniAppId: string) => void;
  logDenied: (miniAppId: string) => void;
}

/** WHY: (C9) a call while signed out leaves the retry armed, so the first signed-in call runs it. */
export function createPendingOptInRetry(deps: PendingOptInRetryDeps): () => Promise<void> {
  let retried = false;
  return async () => {
    if (retried || !deps.uid()) return;
    retried = true;
    const due = deps.due(deps.pending());
    if (due.length === 0) return;
    const status = await deps.checkPermission();
    const { write, deny } = pendingOptInRetries(due, status === 'authorized' || status === 'provisional');
    for (const id of write) deps.write(id, true, 'retry');
    for (const id of deny) {
      deps.clearPending(id);
      deps.logDenied(id);
    }
  };
}

export const retryPendingMiniAppOptIns = createPendingOptInRetry({
  uid: () => authStore.getState().uid,
  pending: () => useSettingsStore.getState().pendingMiniAppOptIns,
  due: (pending) => activeMiniAppOptIns(pending, Date.now()),
  checkPermission,
  write: writeMiniAppSubscription,
  clearPending: (id) => useSettingsStore.getState().setMiniAppOptInPending(id, false),
  logDenied: (id) => logPushSub({ miniapp_id: id, op: 'on', source: 'retry', result: 'denied' }),
});

/**
 * WHY: `isOn` (C8) needs the subscription, the master switch and the OS permission, re-checked on focus
 * and on return to the foreground, since a revoke happens in Settings.
 */
export function useMiniAppPush(
  miniAppId: string,
  {
    onPermissionResolved,
  }: {
    /**
     * WHY: the write after it is fire-and-forget, so a surface may unmount on the answer and lose only the
     * toast; never before, or a trip to the OS settings never comes back.
     */
    onPermissionResolved?: (granted: boolean) => void;
  } = {},
) {
  const { t } = useT();
  const uid = useAuthStore((s) => s.uid);
  const preferences = useNotificationStore((s) => s.preferences);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const isOn = isMiniAppPushOn(preferences, miniAppId, permissionStatus);
  const [notice, setNotice] = useState<string | null>(null);

  const sourceRef = useRef<Source>('toggle');
  const onPermissionResolvedRef = useRef(onPermissionResolved);
  useEffect(() => {
    onPermissionResolvedRef.current = onPermissionResolved;
  });

  const refreshPermission = useCallback(() => {
    void checkPermission()
      .then((status) => useNotificationStore.getState().setPermissionStatus(status))
      .catch(() => undefined);
  }, []);

  useFocusEffect(refreshPermission);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const write = useCallback(
    (on: boolean, source: Source) => {
      writeMiniAppSubscription(miniAppId, on, source, (ok, blocked) => {
        if (blocked) setNotice(t(blocked.messageKey));
        else if (!ok) setNotice(t('eskaraPush.failed'));
        else if (on) setNotice(t('eskaraPush.subscribed'));
      });
    },
    [miniAppId, t],
  );

  const { handleEnable } = useEnableNotificationsFlow({
    onResolved: ({ granted }) => {
      if (granted) {
        write(true, sourceRef.current);
      } else {
        useSettingsStore.getState().setMiniAppOptInPending(miniAppId, false);
        logPushSub({ miniapp_id: miniAppId, op: 'on', source: sourceRef.current, result: 'denied' });
        setNotice(t('eskaraPush.denied'));
      }
      onPermissionResolvedRef.current?.(granted);
    },
  });

  const turnOn = useCallback(
    (source: Source) => {
      sourceRef.current = source;
      // WHY: recorded before the flow, since accepting offline can stall in the registration before the write.
      useSettingsStore.getState().setMiniAppOptInPending(miniAppId, true);
      void (async () => {
        // QUIRK(react-native-firebase): never the cached status: on Android the launch path stores AUTHORIZED,
        // reported without asking, so a blocked device would skip the dialog.
        const status = await checkPermission();
        useNotificationStore.getState().setPermissionStatus(status);
        const granted = status === 'authorized' || status === 'provisional';
        if (granted && useNotificationStore.getState().isTokenRegistered) {
          write(true, source);
          onPermissionResolvedRef.current?.(true);
          return;
        }
        await handleEnable();
      })();
    },
    [handleEnable, write, miniAppId],
  );

  const turnOff = useCallback((source: Source) => write(false, source), [write]);
  const clearNotice = useCallback(() => setNotice(null), []);

  return { uid, isOn, turnOn, turnOff, notice, clearNotice };
}
