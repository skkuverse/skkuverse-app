import { useAuthStore, useSettingsStore } from '@skkuverse/shared';

/**
 * QUIRK(rnscreens): the tab layout passes the accessory prop as `undefined` when this is false; a null
 * child leaves an empty Liquid Glass capsule.
 */
export function useNoticesAccessory(): boolean {
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  return !isAnonymous && onboardingCompleted;
}
