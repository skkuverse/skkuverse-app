import { useMapNavStore } from './map.store';

/** WHY: setter only, so the caller never re-renders on the payload. */
export function useMapNavigation() {
  return useMapNavStore((s) => s.setPendingNavPayload);
}
