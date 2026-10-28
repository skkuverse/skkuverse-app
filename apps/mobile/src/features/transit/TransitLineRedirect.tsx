// WHY: renders nothing; the frame on screen is the one `dismissTo` replaces.

import { useEffect } from 'react';
import { asEntrySource } from '@/platform/analytics.rules';
import { openTransitLine } from './transit.service';

export function TransitLineRedirect({ groupId, source }: { groupId: string; source?: string }) {
  useEffect(() => {
    openTransitLine(groupId, source === undefined ? undefined : asEntrySource(source));
  }, [groupId, source]);
  return null;
}
