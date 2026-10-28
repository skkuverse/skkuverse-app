import type { TabRoute } from '../store/settings';

const VALID_TABS: readonly TabRoute[] = ['home', 'campus', 'transit', 'notices'];

/**
 * WHY: free of Zustand and MMKV so vitest runs it; a tab's route name is its directory under
 * `app/(tabs)/`.
 */
export function resolveInitialTabRouteName(lastTab: unknown): string {
  if (typeof lastTab === 'string' && (VALID_TABS as readonly string[]).includes(lastTab)) {
    return lastTab;
  }
  return 'home';
}
