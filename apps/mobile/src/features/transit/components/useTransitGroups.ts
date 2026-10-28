import { useCallback } from 'react';
import { useSettingsStore } from '@skkuverse/shared';
import { track } from '@/platform/analytics';
import type { TransitGroup } from '../transit.types';

/** WHY: the user's last choice wins, by group id and across launches; a group never toggled follows the server's `initialState`. */
export function useTransitGroups(): {
  isExpanded: (group: TransitGroup) => boolean;
  onToggle: (group: TransitGroup) => void;
} {
  const states = useSettingsStore((s) => s.transitGroupStates);
  const setState = useSettingsStore((s) => s.setTransitGroupState);

  const isExpanded = useCallback(
    (group: TransitGroup) => (states[group.id] ?? group.initialState) === 'expanded',
    [states],
  );

  const onToggle = useCallback(
    (group: TransitGroup) => {
      const next = isExpanded(group) ? 'collapsed' : 'expanded';
      setState(group.id, next);
      track('item_action', {
        view: 'transit_group',
        item_id: group.id,
        action: next === 'expanded' ? 'expand' : 'collapse',
      });
    },
    [isExpanded, setState],
  );

  return { isExpanded, onToggle };
}
