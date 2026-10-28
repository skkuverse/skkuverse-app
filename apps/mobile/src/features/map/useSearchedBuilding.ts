/** WHY: the campus selection stays (ADR 0022 d5); the building's sheet frames it. */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildingDetailQueryOptions } from './building/building.client';
import { useMapNavStore } from './map.store';
import type { MapTabId } from './map-config.types';
import { useMapTask } from './useMapTask';
import { PRESENT_AFTER_MS } from './map-links.constants';

export function useSearchedBuilding(tab: MapTabId) {
  const { select } = useMapTask(tab);
  const queryClient = useQueryClient();
  const pendingPayload = useMapNavStore((s) => s.pendingNavPayload);
  const consumePendingNavPayload = useMapNavStore((s) => s.consumePendingNavPayload);

  useEffect(() => {
    if (!pendingPayload) return;
    const payload = consumePendingNavPayload(tab);
    if (!payload) return;
    // WHY: started now, so the sheet has its content and its frame by the time it rises.
    void queryClient.prefetchQuery(buildingDetailQueryOptions(payload.skkuId));
    setTimeout(() => {
      select({
        kind: 'skku_building',
        placeId: String(payload.skkuId),
        highlightSpaceCd: payload.highlightSpaceCd ?? null,
        source: 'search',
      });
    }, PRESENT_AFTER_MS);
  }, [pendingPayload, consumePendingNavPayload, tab, queryClient, select]);
}
