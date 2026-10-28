import { useEffect, useEffectEvent } from 'react';
import { track } from '@/platform/analytics';
import type { TransitLoadSurface } from '@/platform/analytics.types';

/** WHY: a retry that fails again keeps `failed` true, so it is the same failure, not a second one. */
export function useTransitLoadError(
  surface: TransitLoadSurface,
  itemId: string | undefined,
  failed: boolean,
  retry?: () => unknown,
): { onRetry: () => void } {
  const logError = useEffectEvent(() => {
    track('transit_load_error', { surface, item_id: itemId, op: 'error' });
  });

  useEffect(() => {
    if (failed) logError();
  }, [failed]);

  const onRetry = () => {
    track('transit_load_error', { surface, item_id: itemId, op: 'retry' });
    void retry?.();
  };

  return { onRetry };
}
