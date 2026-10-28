import { createContext, useContext } from 'react';

/**
 * WHY: content that runs under the bar clears it itself; under a native tab bar nothing provides this and
 * it reads 0, the safe area answering instead. Here, since no feature imports `bootstrap/`.
 */
export const TabBarInsetContext = createContext(0);

export function useTabBarInset(): number {
  return useContext(TabBarInsetContext);
}
