import { useEffect, useRef } from 'react';
import { usePathname, useRootNavigationState } from 'expo-router';
import { openPendingMiniAppLink, pendingMiniAppLink } from '@/features/web/web.service';

// WHY: the pathname is read through a ref when the link resolves, so one resolving after the user left home is dropped.
export function PendingMiniAppLinkConsumer() {
  const navState = useRootNavigationState();
  const pathname = usePathname();
  const path = useRef(pathname);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!navState?.key) return;
    const open = () => openPendingMiniAppLink(() => path.current);
    open();
    return pendingMiniAppLink.subscribe(open);
  }, [navState?.key]);

  return null;
}
