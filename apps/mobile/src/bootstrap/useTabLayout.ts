import { useNotificationStore, useSettingsStore } from '@skkuverse/shared';

export function useTabLayout() {
  const lastTab = useSettingsStore((s) => s.lastTab);
  const setLastTab = useSettingsStore((s) => s.setLastTab);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  return { lastTab, setLastTab, unreadCount };
}
