import { useSettingsStore } from '@skkuverse/shared';

export function useAppLanguage() {
  return useSettingsStore((s) => s.appLanguage);
}
