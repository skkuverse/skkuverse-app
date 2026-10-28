// WHY: renders nothing; the frame on screen is the one `dismissTo` replaces.

import { useEffect } from 'react';
import { asEntrySource } from '@/platform/analytics.rules';
import { openTransitStation } from './transit.service';

export function TransitStationRedirect({ station, lineParam, source }: { station: string; lineParam?: string; source?: string }) {
  useEffect(() => {
    openTransitStation(station, lineParam, source === undefined ? undefined : asEntrySource(source));
  }, [station, lineParam, source]);
  return null;
}
