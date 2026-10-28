import { useNoticesUiStore } from './notices.store';

export function useActiveNoticeTab() {
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const setActiveTabKey = useNoticesUiStore((s) => s.setActiveTabKey);
  return { activeTabKey, setActiveTabKey };
}
