import { useT } from '@skkuverse/shared';
import { useNoticesUiStore } from './notices.store';
import { useNoticeTabs } from './useNoticeTabs';

/** WHY: before the active tab's label resolves, the placeholder has no prefix, so it never opens on a space. */
export function useNoticesSearchPlaceholder(): string {
  const { t, tpl } = useT();
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const { data: tabsConfig } = useNoticeTabs();

  const activeLabel =
    tabsConfig?.tabs.find((tab) => tab.key === activeTabKey)?.label ?? '';

  if (!activeLabel) return t('notices.accessory.searchPlaceholder');
  return tpl('notices.search.placeholderWithTab', activeLabel);
}
