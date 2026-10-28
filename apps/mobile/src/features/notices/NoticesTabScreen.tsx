/**
 * QUIRK(rnscreens): no outer View; each branch returns the list (or a Fragment led by it), since the
 * minimize finder sees only RNSScreen's subviews[0].
 * SEE: docs/explanation/ios-26-native-tabs-minimize.md ("How the notices tab applies it")
 */

import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticesTabStrip } from './components/NoticesTabStrip';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './NoticeEmptyState';
import { useNoticesTabScreen } from './useNoticesTabScreen';

export function NoticesTabScreen() {
  const {
    t,
    isLoading,
    isError,
    refetch,
    hasValidTabs,
    activeTab,
    openPicker,
    pickerSelectedIds,
    pickerSelectorLabel,
  } = useNoticesTabScreen();

  // QUIRK(rnscreens): the skeleton has no scroll view, so the finder returns nil until the root swaps to
  // the list, which re-fires `mountChildComponentView(index==0)` and finds it.
  if (!activeTab) {
    if (isLoading) return <NoticeListSkeleton />;
    if (isError || !hasValidTabs) {
      return (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      );
    }
    return null;
  }

  if (activeTab.tabMode === 'picker' && activeTab.picker) {
    return (
      <NoticeListPanel
        sourceIds={pickerSelectedIds}
        scrollsToTopOn="notices"
        listHeader={
          <>
            <NoticesTabStrip />
            <NoticeSelector
              label={pickerSelectorLabel}
              onPress={() => openPicker(activeTab.key)}
            />
          </>
        }
      />
    );
  }

  if (activeTab.tabMode === 'fixed' && activeTab.fixed) {
    return (
      <NoticeListPanel
        sourceId={activeTab.fixed.sourceId}
        scrollsToTopOn="notices"
        listHeader={<NoticesTabStrip />}
      />
    );
  }

  return null;
}
