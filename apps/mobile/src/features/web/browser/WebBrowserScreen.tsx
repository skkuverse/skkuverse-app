/**
 * WHY: minimal chrome (header, content, ad banner), since the rich chrome describes a registry entry a
 * notice source page lacks. Bridge access is not this screen's: it is resolved per message from the
 * posting document's origin (capabilities.rules.ts).
 */

import {
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useT } from '@skkuverse/shared';
import { WEB_BRIDGE_ADVERTISEMENT_JS } from '../web-action.rules';
import { Loader, ResultSection, createThemedStyles } from '@skkuverse/sds';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/platform/ads';
import { useWebBrowser } from './useWebBrowser';

export function WebBrowserScreen({ title, url }: { title?: string; url?: string }) {
  const styles = useStyles();
  const { t } = useT();
  const {
    webViewRef,
    startUrl,
    headerTitle,
    canGoBack,
    loading,
    failed,
    onNavigationStateChange,
    handleMessage,
    reload,
    onShouldStartLoadWithRequest,
    onLoadStart,
    onLoadEnd,
    onError,
    onHttpError,
  } = useWebBrowser({ title, url });

  if (startUrl === null) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={styles.container}>
      {/*
        QUIRK(ios): with page history the screen-pop gesture is off so WKWebView owns the swipe (page back);
        at the root it is on and the swipe closes the screen. Leaving both on makes the swipe non-deterministic.
      */}
      <Stack.Screen options={{ title: headerTitle, gestureEnabled: !canGoBack }} />

      <View style={styles.content}>
        <WebView
          ref={webViewRef}
          source={{ uri: startUrl }}
          style={styles.webview}
          onMessage={handleMessage}
          // WHY: advertises the actions this host accepts, so a page shows a button only where it works; the gate
          // still grants.
          injectedJavaScriptBeforeContentLoaded={WEB_BRIDGE_ADVERTISEMENT_JS}
          onNavigationStateChange={onNavigationStateChange}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onError={onError}
          onHttpError={onHttpError}
          javaScriptEnabled
          domStorageEnabled
          // WHY: paired with gestureEnabled above, so the WebView claims the swipe only with history (no-op on
          // Android).
          allowsBackForwardNavigationGestures={canGoBack}
        />

        {/* WHY: covers the white flash before first paint; `startInLoadingState`'s spinner cannot be themed. */}
        {loading && !failed ? (
          <View style={styles.overlay} pointerEvents="none">
            <Loader size="medium" tone="neutral" delay={700} />
          </View>
        ) : null}

        {/* WHY: replaces the browser's raw error page, which speaks another visual language and another language. */}
        {failed ? (
          <View style={styles.overlay}>
            <ResultSection
              title={t('error.somethingWrong')}
              description={t('error.checkNetwork')}
              primaryActionProps={{ children: t('common.retry'), onPress: reload }}
            />
          </View>
        ) : null}
      </View>

      <AdaptiveBanner unitId={AdUnitIds.webviewBanner} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  // WHY: wraps the WebView so the overlays cover the content without covering the ad banner.
  content: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.layerFloating,
  },
}));

