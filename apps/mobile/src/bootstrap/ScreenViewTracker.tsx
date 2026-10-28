import { useEffect, useRef } from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { decideScreenView, type ScreenOverlay } from '@/bootstrap/screen-names.rules';
import { logScreenView } from '@/platform/analytics';

/**
 * WHY: rendered by InitGate, not the root layout: only InitGate knows when init has set the analytics
 * context and user id, and what it draws over the router (the intro).
 */
export function ScreenViewTracker({
  ready,
  overlay,
}: {
  ready: boolean;
  overlay: ScreenOverlay | null;
}) {
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const { key, log } = decideScreenView(lastKey.current, { ready, overlay, pathname, params });
    lastKey.current = key;
    if (log) logScreenView(log);
  }, [ready, overlay, pathname, params]);

  return null;
}
