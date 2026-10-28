import type { RefObject } from 'react';
import type { SheetRef } from '@skkuverse/sds';
import { useAuthStore, useNotificationStore } from '@skkuverse/shared';
import { setMasterEnabled } from './notifications.service';
import { useEnableNotificationsFlow } from './useEnableNotificationsFlow';

export function useEnableNotificationsSheet(sheetRef: RefObject<SheetRef | null>) {
  const uid = useAuthStore((s) => s.uid);
  const setDismissed = useNotificationStore(
    (s) => s.setEnableSheetDismissedThisSession,
  );

  const { handleEnable } = useEnableNotificationsFlow({
    onResolved: () => sheetRef.current?.dismiss?.(),
    additionalOnGranted: uid ? () => setMasterEnabled(uid, true) : undefined,
  });

  return { handleEnable, setDismissed };
}
