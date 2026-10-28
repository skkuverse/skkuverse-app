import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import {
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { clearOsBadge } from '@/platform/notifications';
import { useActiveNoticeTab } from './useActiveNoticeTab';
import { resolvePickerSelection } from './picker.rules';
import { useNoticeTabs } from './useNoticeTabs';

export function useNoticesTabScreen() {
  const { t } = useT();
  const router = useRouter();
  const { data: tabsConfig, isLoading, isError, refetch } = useNoticeTabs();
  const tabs = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);

  useFocusEffect(
    useCallback(() => {
      void clearOsBadge();
      useNotificationStore.getState().resetUnread();
    }, []),
  );

  const { activeTabKey, setActiveTabKey } = useActiveNoticeTab();

  useEffect(() => {
    if (tabs.length > 0 && !activeTabKey) {
      setActiveTabKey(tabs[0].key);
    }
  }, [tabs, activeTabKey, setActiveTabKey]);

  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );

  const openPicker = useCallback(
    (tabKey: string) => {
      router.push(`/notices/picker?tabKey=${encodeURIComponent(tabKey)}`);
    },
    [router],
  );

  const hasValidTabs = tabs.length > 0;
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === activeTabKey),
    [tabs, activeTabKey],
  );

  const pickerSelectedIds = useMemo(
    () =>
      activeTab && activeTab.tabMode === 'picker' && activeTab.picker
        ? resolvePickerSelection(
            activeTab,
            pickerSelections[activeTab.key],
            // WHY: the dept tab's sources[0] fallback is right for a first-time user and the sign of a
            // silently failed save for anyone else, so it is reported instead of waiting for a support message.
            () =>
              logHandledError(
                'notices/picker-fallback-first-source',
                new Error(
                  `picker fell back to sources[0] on tab '${activeTab.key}'`,
                ),
              ),
          )
        : [],
    [activeTab, pickerSelections],
  );

  const pickerSelectorLabel = useMemo(() => {
    if (!activeTab || activeTab.tabMode !== 'picker' || !activeTab.picker) {
      return '';
    }
    return pickerSelectedIds
      .map(
        (id) =>
          activeTab.picker!.sources.find((s) => s.id === id)?.name ?? id,
      )
      .join(', ');
  }, [activeTab, pickerSelectedIds]);

  return {
    t,
    isLoading,
    isError,
    refetch,
    hasValidTabs,
    activeTab,
    openPicker,
    pickerSelectedIds,
    pickerSelectorLabel,
  };
}
