/**
 * WHY: the sheet is dismissed before an in-app push, since it is presented above the root navigator; leaving
 * for another app pushes nothing and sends no focus, so the sheet stays up there.
 */

import { useCallback } from 'react';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import { type ActionType, instagramDestination } from '@skkuverse/shared';
import { handleSduiAction, leavesApp as urlLeavesApp } from '@/features/web/web.service';
import { track } from '@/platform/analytics';
import type { ItemAction } from '@/platform/analytics.rules';
import { openExternalUrl } from '@/platform/handoff';
import { topmostEntry } from '../../map-task.rules';
import { useMapStore } from '../../map.store';
import type { PlaceInstagramAction } from '../place-detail.types';

export function trackPlaceAction(action: ItemAction, target?: string) {
  const { tasks, activeTab } = useMapStore.getState();
  const placeId = topmostEntry(tasks[activeTab], 'event')?.request.placeId;
  track('item_action', { view: 'place_sheet', item_id: placeId, action, target });
}

const ACTION_OF: Partial<Record<ActionType, ItemAction>> = {
  route: 'route',
  webview: 'webview',
  external: 'external',
  miniapp: 'miniapp',
};

export function useInstagramNavigate() {
  return useCallback((action: PlaceInstagramAction) => {
    const url = instagramDestination(action.profileUrl, action.postUrl);
    trackPlaceAction('instagram');
    if (url) void openExternalUrl(url).catch(() => {});
  }, []);
}

function leavesApp(actionType: ActionType, actionValue: string): boolean {
  return (actionType === 'webview' || actionType === 'external') && urlLeavesApp(actionValue);
}

export function usePlaceNavigate(onNavigateAway?: () => void) {
  const { dismiss } = useBottomSheetModal();
  return useCallback(
    ({
      actionType,
      actionValue,
      title,
      kind,
    }: {
      actionType: ActionType;
      actionValue: string;
      title: string;
      kind?: ItemAction;
    }) => {
      trackPlaceAction(kind ?? ACTION_OF[actionType] ?? 'external', actionValue);
      if (!leavesApp(actionType, actionValue)) {
        onNavigateAway?.();
        dismiss();
      }
      handleSduiAction({ actionType, actionValue, webviewTitle: title, source: 'place_sheet' });
    },
    [dismiss, onNavigateAway],
  );
}
