import { resolveInitialTabRouteName, useSettingsStore } from '@skkuverse/shared';

// WHY: `unstable_settings.initialRouteName` is consumed at module evaluation time by
// expo-router's getRoutesCore. We read MMKV-backed lastTab synchronously (Zustand+MMKV is fully
// sync — no try/catch / no race), and resolve via the shared pure mapper.
export function initialTabRouteName(): string {
  return resolveInitialTabRouteName(useSettingsStore.getState().lastTab);
}
