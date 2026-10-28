import { createContext, useContext, useEffect } from 'react';
import { useNavigation } from 'expo-router';
import type { TabRoute } from '@skkuverse/shared';

export interface TabRetapRegistry {
  register: (tab: TabRoute, scrollToTop: () => void) => () => void;
}

/**
 * WHY: here, not in `bootstrap/`, since a feature registers and no feature imports `bootstrap/`. Under the
 * native tabs nothing provides it, and the hook does nothing.
 */
export const TabRetapContext = createContext<TabRetapRegistry | null>(null);

/**
 * WHY: pass a stable `scrollToTop` (`useCallback`); it runs only while the screen is focused, since with a
 * page pushed over it the press pops the tab's Stack instead. A null `tab` is a root pushed as a page.
 */
export function useScrollToTopOnRetap(tab: TabRoute | null, scrollToTop: () => void): void {
  const registry = useContext(TabRetapContext);
  const navigation = useNavigation();

  useEffect(() => {
    if (!registry || !tab) return;
    return registry.register(tab, () => {
      if (navigation.isFocused()) scrollToTop();
    });
  }, [registry, tab, navigation, scrollToTop]);
}
