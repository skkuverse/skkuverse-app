import { QueryClient } from '@tanstack/react-query';

/**
 * WHY: a plain .ts apart from the provider, so a caller outside the React tree reaches it without
 * React on its import path.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // WHY: axios-retry owns every retry; a second layer multiplied them into synchronized bursts.
      retry: false,
    },
  },
});
