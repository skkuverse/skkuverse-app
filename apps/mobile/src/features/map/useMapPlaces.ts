/** WHY: withdrawn when the feed unmounts; memoise `places`, or every render republishes. */

import { useEffect } from 'react';
import type { FedPlaceKind, MapPlace } from './overlay.types';
import { useMapRegistry } from './useMapRegistry';

export function useMapPlaces(kind: FedPlaceKind, places: readonly MapPlace[] | null): void {
  const { publishPlaces } = useMapRegistry();
  useEffect(() => {
    publishPlaces(kind, places);
    return () => publishPlaces(kind, null);
  }, [publishPlaces, kind, places]);
}
