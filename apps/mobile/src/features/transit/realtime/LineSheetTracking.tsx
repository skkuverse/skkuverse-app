import { useEffect, useRef } from 'react';
import type { MapSheetTrackingProps } from '@/features/map/sheet-views.types';
import { logBusRouteOpen, track, useViewTracking } from '@/platform/analytics';
import { useScreenReader } from '@/platform/useScreenReader';
import { isLineExpand } from './line.rules';
import { useBusConfig } from '../useBusConfig';

export function LineSheetTracking({ entry }: MapSheetTrackingProps<'line'>) {
  const { groupId, source } = entry.request;
  useViewTracking('line_sheet', groupId, source);

  const label = useBusConfig(groupId).data?.label;
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || label === undefined) return;
    opened.current = true;
    logBusRouteOpen({ routeId: groupId, routeLabel: label, screenType: 'realtime', source });
  }, [label, groupId, source]);

  const screenReader = useScreenReader();
  const expanded = useRef(false);
  useEffect(() => {
    if (expanded.current || !isLineExpand(entry.detent, screenReader)) return;
    expanded.current = true;
    track('item_action', { view: 'line_sheet', item_id: groupId, action: 'expand', target: entry.detent });
  }, [entry.detent, screenReader, groupId]);

  return null;
}
