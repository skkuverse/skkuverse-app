import { useCallback } from 'react';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSettingsStore, type TabRoute } from '@skkuverse/shared';
import { logTabSwitch } from '@/platform/analytics';
import { SHELL } from './shell.service';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

/**
 * QUIRK(expo-router): NativeTabs exposes no screenListeners, so iOS 26 logs here. The guard mirrors the
 * NativeTabs fork in app/(tabs)/_layout.tsx; keep them in sync or a switch logs twice or not at all.
 */
export function useTabFocusTracking(tab: TabRoute) {
  const setLastTab = useSettingsStore((s) => s.setLastTab);

  useFocusEffect(
    useCallback(() => {
      if (!GLASS_AVAILABLE || SHELL === 'shared-map') return;
      logTabSwitch(tab, { withCause: false });
      setLastTab(tab);
    }, [tab, setLastTab]),
  );
}
