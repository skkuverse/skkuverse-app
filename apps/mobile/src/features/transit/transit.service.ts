
import { router } from 'expo-router';
import type { MapPlaceRef } from '@skkuverse/shared';
import { openMapAtPlace } from '@/features/map/map.service';
import type { PageOrigin } from '@/features/map/sheet-stack.types';
import { markTabSwitch } from '@/platform/analytics';
import { withEntrySource, type EntrySource } from '@/platform/analytics.rules';
import { transitSheetQueue, type PendingTransitSheet } from './transit.store';

export { transitSheetQueue as pendingTransitSheet } from './transit.store';

/**
 * WHY: `dismissTo`, not `push`: the caller is a route above the tabs, and the tab should replace it.
 * The request is set before navigating, so a mounted transit tab's subscriber opens it at once.
 */
function openTransitSheet(request: PendingTransitSheet): void {
  transitSheetQueue.set(request);
  markTabSwitch('transit', 'sheet');
  router.dismissTo('/(tabs)/transit' as never);
}

// WHY: a route that named no source logs `other`.
export function openTransitLine(groupId: string, source: EntrySource = 'other'): void {
  openTransitSheet({ kind: 'line', groupId, source });
}

export function openTransitStation(stationId: string, line?: string, source: EntrySource = 'other'): void {
  openTransitSheet({ kind: 'subway_station', stationId, ...(line && { line }), source });
}

// WHY: the native tabs have no map under a page, so a station a page asks for pushes `/subway` over it.
export function openPlaceAsScreen(ref: MapPlaceRef, source?: EntrySource, origin?: PageOrigin): void {
  if (!origin || ref.kind !== 'subway_station') {
    openMapAtPlace(ref, source);
    return;
  }
  const path = `/subway?station=${encodeURIComponent(ref.placeId)}`;
  router.push((source ? withEntrySource(path, source) : path) as never);
}
