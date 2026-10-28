import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * WHY: one identity for the host's life, since a handler that changed with the focused tab re-rendered every
 * marker in the memoised `MapCanvas` on a tab switch. Only events call it, never render.
 */
export function useStableHandler<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
