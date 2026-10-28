import { useViewTracking } from '@/platform/analytics';
import type { MapSheetEntryOf } from '../sheet-stack.types';
import { useMapWorld } from '../useMapWorld';
import { usePlaceDetails } from './usePlaceDetails';

export function usePlaceSheet(entry: MapSheetEntryOf<'event'>) {
  const { eventPlaces, now } = useMapWorld();
  const { placeId, source } = entry.request;

  // WHY: resolved against every event overlay, so an open sheet survives a layer toggle that hides it.
  const place = eventPlaces.byId.get(placeId) ?? null;
  const detail = usePlaceDetails(eventPlaces.endpoint).data?.[placeId] ?? null;

  useViewTracking('place_sheet', placeId, source);

  /**
   * WHY: `settled` is load-bearing: `byId` is empty until the first fetch, so before it a gone place cannot be
   * told from one not yet arrived. Ops deletes a cancelled booth, and an empty sheet is worse than none.
   */
  const gone = eventPlaces.settled && place === null;

  return { place, detail, now, gone };
}
