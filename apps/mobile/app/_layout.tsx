import { useEffect } from 'react';
// WHY: at module load, outside every error boundary, so hot-updater sees each launch to decide a rollback.
import '@/platform/ota-init';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SchemeStatusBar } from '@/components/SchemeStatusBar';
import { ErrorBoundary } from '@/bootstrap/ErrorBoundary';
import { KeyboardProvider } from '@/bootstrap/KeyboardProvider';
import { QueryProvider } from '@/bootstrap/QueryProvider';
import { InitGate } from '@/bootstrap/InitGate';
import { SDSProvider, useSemanticColors } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { useNotificationHandler } from '@/bootstrap/notifications/useNotificationHandler';
import { useDefaultHeaderOptions } from '@/components/useDefaultHeaderOptions';
import { SHELL } from '@/bootstrap/shell.service';
import { openMapAtPlace } from '@/features/map/map.service';
import { openPlaceAsScreen } from '@/features/transit/transit.service';
import { registerMapPlaceOpener } from '@/features/web/web.service';
import { PendingNoticeLinkConsumer } from '@/bootstrap/deep-links/PendingNoticeLinkConsumer';
import { PendingProfileSetupConsumer } from '@/bootstrap/deep-links/PendingProfileSetupConsumer';
import { PendingMiniAppLinkConsumer } from '@/bootstrap/deep-links/PendingMiniAppLinkConsumer';
import { PendingSduiActionConsumer } from '@/bootstrap/deep-links/PendingSduiActionConsumer';
import { UnopenableGameToast } from '@/features/web/UnopenableGameToast';

// WHY: registered at module load so the first SDUI `map` action already reaches map; web cannot import map.
// Shared map opens a place as a sheet over the map; the native tabs have no map, so a station is a screen.
registerMapPlaceOpener(SHELL === 'shared-map' ? openMapAtPlace : openPlaceAsScreen);

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const color = useSemanticColors();
  const headerOptions = useDefaultHeaderOptions();
  useNotificationHandler();

  // WHY: app.config registers all four directions in Info.plist so lockAsync can rotate; the video gallery locks landscape temporarily.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const { t } = useT();

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
        {/* WHY: above InitGate, whose intro branch replaces children and renders FixedBottomCTA, which reads this provider on iOS. */}
        <KeyboardProvider>
        <SDSProvider>
          {/* QUIRK(android): outside InitGate on purpose; the gate's branches (intro, ForceUpdateScreen) replace
              children, and without a StatusBar there Android draws light icons on the intro's white background. */}
          <SchemeStatusBar />
          <QueryProvider>
            <InitGate>
              <BottomSheetModalProvider>
              <Stack screenOptions={headerOptions}>
                {/* WHY: each tab owns a nested Stack for its header, so tab switches never toggle headerShown and shift content. */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Skkuverse' }} />
                {/* WHY: cold start never mounts app/index.tsx, but the title keeps a leaked entry from showing a blank row in the iOS long-press back menu. */}
                <Stack.Screen
                  name="index"
                  options={{ headerShown: false, title: t('nav.home') }}
                />
                <Stack.Screen
                  name="search"
                  options={{
                    headerShown: false,
                    animation: 'none',
                  }}
                />

                <Stack.Screen
                  name="settings/index"
                  options={{ title: t('settings.title') }}
                />
                <Stack.Screen
                  name="notifications/settings"
                  options={{ title: t('notifications.settings') }}
                />
                <Stack.Screen
                  name="notifications/essential"
                  options={{ title: t('notifications.essential') }}
                />
                <Stack.Screen
                  name="notifications/services"
                  options={{ title: t('notifications.services') }}
                />
                <Stack.Screen
                  name="notifications/notices"
                  options={{ title: t('notifications.notices') }}
                />
                <Stack.Screen
                  name="notices/saved"
                  options={{ title: t('notices.saved') }}
                />
                <Stack.Screen
                  name="miniapp-feed/[id]"
                  options={{ title: t('miniappFeed.title') }}
                />
                {/* WHY: RELEASE-GATE(debug-menu); remove this entry, app/settings/debug-logs.tsx, src/dev/debug-logs and the settings debug row before the App Store release. */}
                <Stack.Screen
                  name="settings/debug-logs"
                  options={{ title: '디버깅 로그' }}
                />
                <Stack.Screen
                  name="map/hssc"
                  options={{ title: '인사캠 건물지도' }}
                />
                <Stack.Screen
                  name="map/hssc-credit"
                  options={{ title: '인사캠 건물지도' }}
                />
                <Stack.Screen name="webview" />
                <Stack.Screen name="mini-app" />

                <Stack.Screen
                  name="onboarding"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="login"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                {/* WHY: the page takes every touch to the edges (wave-run's left half is its duck control), so no edge-swipe back. */}
                <Stack.Screen
                  name="games/[id]/index"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                {/* WHY: transparent so what opened the Hall of Fame stays in view, dimmed. */}
                <Stack.Screen
                  name="games/[id]/leaderboard"
                  options={{
                    headerShown: false,
                    presentation: 'transparentModal',
                    animation: 'fade',
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
                <Stack.Screen
                  name="profile-setup"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="sds-states"
                  options={{
                    title: 'SDS States',
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="auth-faults"
                  options={{
                    title: 'Auth faults',
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen name="video-gallery" options={{ headerShown: false }} />
                <Stack.Screen
                  name="video-player"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    gestureEnabled: false,
                  }}
                />
                {/* QUIRK(react-native-screens): formSheet swallows the inner SectionList's vertical pan on Paper (software-mansion/react-native-screens#2424); revisit if fixed or after Fabric. */}
                <Stack.Screen
                  name="notices/picker"
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    contentStyle: { backgroundColor: color.bg.layerDefault },
                  }}
                />
              </Stack>
              <PendingNoticeLinkConsumer />
              <PendingProfileSetupConsumer />
              <PendingMiniAppLinkConsumer />
              <PendingSduiActionConsumer />
              <UnopenableGameToast />
              {/* WHY: a dev-host banner would belong here, after <Stack> and inside SafeAreaProvider; inside a tab's RNSScreen it becomes subviews[0] and kills iOS 26 NativeTabs minimize and contentInset. */}
              </BottomSheetModalProvider>
            </InitGate>
          </QueryProvider>
        </SDSProvider>
        </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
