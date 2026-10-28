import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';
import type { PreferencesDocument } from './notifications.types';

/**
 * WHY: preferences are never persisted: Firestore is their source, and a stale local copy would fight
 * another device's update.
 */
export type PushPermissionStatus =
  | 'notDetermined'
  | 'authorized'
  | 'denied'
  | 'provisional';

interface NotificationState {
  fcmToken: string | null;
  deviceId: string | null;
  isTokenRegistered: boolean;
  permissionStatus: PushPermissionStatus;
  preferences: PreferencesDocument;
  unreadCount: number;
  /**
   * WHY: left out of partialize, so the enable sheet gets one fresh attempt per launch even after an
   * earlier dismissal.
   */
  enableSheetDismissedThisSession: boolean;
}

interface NotificationActions {
  setFcmToken: (token: string | null) => void;
  setDeviceId: (id: string | null) => void;
  setIsTokenRegistered: (v: boolean) => void;
  setPermissionStatus: (s: PushPermissionStatus) => void;
  setPreferences: (p: PreferencesDocument) => void;
  resetPreferences: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  setEnableSheetDismissedThisSession: (v: boolean) => void;
}

export type NotificationStore = NotificationState & NotificationActions;

/**
 * WHY: also the value after a uid change, so one account's choices never show as another's before the
 * new listener delivers.
 */
export const DEFAULT_PREFERENCES: PreferencesDocument = {
  enabled: false,
  // WHY: `essential` is always on (rules, derive and UI all lock it); false here would show the locked
  // toggle off until Firestore syncs.
  categoryEnabled: { essential: true, services: false, notices: false },
  noticeTabEnabled: {},
  pickerSelections: {},
  subscribedTopics: [],
  derivedAt: null,
  onboardedAt: null,
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      fcmToken: null,
      deviceId: null,
      isTokenRegistered: false,
      permissionStatus: 'notDetermined',
      preferences: DEFAULT_PREFERENCES,
      unreadCount: 0,
      enableSheetDismissedThisSession: false,

      setFcmToken: (fcmToken) => set({ fcmToken }),
      setDeviceId: (deviceId) => set({ deviceId }),
      setIsTokenRegistered: (isTokenRegistered) => set({ isTokenRegistered }),
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setPreferences: (preferences) => set({ preferences }),
      resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),
      incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
      resetUnread: () => set({ unreadCount: 0 }),
      setEnableSheetDismissedThisSession: (enableSheetDismissedThisSession) =>
        set({ enableSheetDismissedThisSession }),
    }),
    {
      name: 'notifications',
      version: 2,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({
        fcmToken: state.fcmToken,
        deviceId: state.deviceId,
        isTokenRegistered: state.isTokenRegistered,
        permissionStatus: state.permissionStatus,
        unreadCount: state.unreadCount,
      }),
    },
  ),
);

export const notificationStore = useNotificationStore;
