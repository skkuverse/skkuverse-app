import { useCallback } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DotsThreeIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { GLASS_AVAILABLE, Loader, Toast, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { useDefaultHeaderOptions } from '@/components/useDefaultHeaderOptions';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { HeaderPill } from './components/HeaderPill';
import { BottomBar } from './components/BottomBar';
import { FloatingBackButton } from './components/FloatingBackButton';
import { FloatingMoreButton } from './components/FloatingMoreButton';
import { MoreSheet } from './components/MoreSheet';
import { NoticeBanner } from './components/NoticeBanner';
import { BAR_H, BAR_MIN_PAD_BOTTOM, BAR_PAD_TOP } from './components/bottom-bar.constants';
import { useCollapsingBar } from './components/useCollapsingBar';
import { pillLabelTone } from './pill.rules';
import { useMiniAppShell } from './useMiniAppShell';

// WHY: the room the header's ‹ and ⋯ buttons keep beside the top pill.
const HEADER_PILL_SIDE_RESERVE = 140;

// QUIRK(rnscreens): unstable_headerRightItems takes an SF Symbol or an image only, so the
// icon is a baked PNG (scripts/export-header-icons.mjs), untinted to keep the navbar tint off.
const ICON_MORE = require('../../../../assets/header-icons/dots-three.png');

export function MiniAppShellScreen(params: { id?: string; path?: string; source?: string }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const headerOptions = useDefaultHeaderOptions();
  const insets = useSafeAreaInsets();
  // WHY: only the part of the bar above the device's own bottom inset counts.
  const bottomBarHeight =
    BAR_PAD_TOP + BAR_H + Math.max(insets.bottom, BAR_MIN_PAD_BOTTOM) - insets.bottom;
  const {
    miniAppPush,
    masterEnabled,
    showPushToggle,
    moreOpen,
    closeMore,
    handleTogglePush,
    detail,
    shell,
    bar,
    isBottomBar,
    isOverlay,
    initialUrl,
    pill,
    webRef,
    headerHeight,
    onScrollY,
    onLoadStart,
    source,
    canGoBack,
    canGoForward,
    noticeVisible,
    dismissNotice,
    onNavChange: onShellNavChange,
    handleMessage,
    bootstrapScript,
    markLoad,
    goBack,
    goForward,
    openMore,
    handleMenuRefresh,
    onShouldStartLoad,
  } = useMiniAppShell(params, { insets, bottomBarHeight });
  // QUIRK(ios): without Liquid Glass an overlay header's system buttons have no background.
  // SEE: docs/explanation/miniapp-shell.md ("Shell: the registry decides the chrome")
  const floatingHeaderButtons = isOverlay && !GLASS_AVAILABLE;
  // QUIRK(rnscreens): on iOS the header is always translucent so a back swipe cannot move the frame.
  // SEE: docs/explanation/miniapp-shell.md ("The iOS back swipe: the WebView's frame stays put")
  const headerOverContent = isOverlay || Platform.OS === 'ios';
  const pillTone = pillLabelTone(shell.statusBar, GLASS_AVAILABLE);


  const { width: screenW } = useWindowDimensions();
  const collapsingBar = useCollapsingBar(screenW, isBottomBar);
  const { expand: expandBar, onScroll: onBarScroll } = collapsingBar;
  const headerPillMaxW = Math.max(80, screenW - HEADER_PILL_SIDE_RESERVE);

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      onShellNavChange(nav);
      expandBar();
    },
    [onShellNavChange, expandBar],
  );

  // QUIRK(reanimated): useAnimatedScrollHandler cannot attach to a WebView, so this is a JS callback.
  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;
      // WHY: recorded even without a bottom bar, for the cancelled-swipe restore.
      onScrollY(y);
      onBarScroll(y);
    },
    [onScrollY, onBarScroll],
  );

  // WHY: no name yet means no pill; an empty capsule with only a logo looks broken.
  const headerPill =
    bar === 'top' && pill.name ? (
      <HeaderPill logo={pill.logo} faviconUri={pill.faviconUri} name={pill.name} tone={pillTone} maxWidth={headerPillMaxW} />
    ) : null;

  const headerItems = floatingHeaderButtons
    ? {
        headerBackVisible: false,
        headerLeft: () => <FloatingBackButton pill={headerPill} />,
        headerRight: () => <FloatingMoreButton onPress={openMore} />,
      }
    : {
        // QUIRK(rnscreens): headerBackVisible keeps the native back beside a custom left item,
        // and hidesSharedBackground stops a second glass capsule around the pill's own.
        ...(headerPill
          ? Platform.OS === 'ios'
            ? {
                headerBackVisible: true,
                unstable_headerLeftItems: () => [
                  { type: 'custom' as const, element: headerPill, hidesSharedBackground: true },
                ],
              }
            : { headerBackVisible: true, headerLeft: () => headerPill }
          : {}),
        ...(Platform.OS === 'ios'
          ? {
              unstable_headerRightItems: () => [
                {
                  type: 'button' as const,
                  label: '',
                  icon: { type: 'image' as const, source: ICON_MORE, tinted: false },
                  sharesBackground: true,
                  accessibilityLabel: '더보기',
                  onPress: openMore,
                },
              ],
            }
          : {
              headerRight: () => (
                <View style={styles.rightGroup}>
                  <HeaderIconButton onPress={openMore} accessibilityLabel="더보기">
                    <DotsThreeIcon size={22} color={color.fg.neutralMuted} weight="bold" />
                  </HeaderIconButton>
                </View>
              ),
            }),
      };

  return (
    <View
      // WHY: an opaque shell on iOS pads itself below the translucent header, by a height
      // the swipe guard holds still.
      style={[
        styles.container,
        { backgroundColor: shell.background },
        headerOverContent && !isOverlay && { paddingTop: headerHeight },
      ]}
    >
      <StatusBar style={shell.statusBar === 'light' ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          ...headerOptions,
          headerShown: true,
          title: '',
          ...(isOverlay
            ? { headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }
            : headerOverContent
              ? { headerTransparent: true, headerStyle: { backgroundColor: shell.background } }
              : {}),
          ...headerItems,
          // QUIRK(ios): exactly one edge-swipe recognizer is on: WKWebView's while it has history
          // (allowsBackForwardNavigationGestures below), the screen's pop at its root.
          gestureEnabled: !canGoBack,
        }}
      />

      {/* WHY: mounted only once the URL is known; an earlier mount leaves about:blank in the
          history, where back would land. */}
      {initialUrl ? (
        <WebView
          ref={webRef}
          source={source}
          // WHY: the WebView's own background covers the white flash before first paint and on overscroll.
          style={[styles.webview, { backgroundColor: shell.background }]}
          onNavigationStateChange={onNavChange}
          // WHY: every navigation goes through handOffMiniAppLinks, not the library's own app-scheme
          // launch, which would let any page open a declared app on load; it also keeps another
          // origin's page out of the shell.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onMessage={handleMessage}
          // SEE: docs/explanation/miniapp-shell.md ("What a page finds before its own script runs")
          injectedJavaScriptBeforeContentLoaded={bootstrapScript}
          onScroll={onScroll}
          onLoadStart={onLoadStart}
          onLoadEnd={() => markLoad('load_end')}
          onError={() => markLoad('error')}
          onHttpError={({ nativeEvent }) => {
            // QUIRK(webview): only the document's own 4xx and 5xx arrive, never a subresource's.
            if (nativeEvent.statusCode >= 400) markLoad('http_error', nativeEvent.statusCode);
          }}
          // WHY: a dead content process leaves a blank page; it is only recorded.
          onContentProcessDidTerminate={() => markLoad('terminated')}
          onRenderProcessGone={() => markLoad('terminated')}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          // WHY: the default loading view is white, which flashes on a dark shell.
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: shell.background }]}>
              <Loader size="medium" tone={shell.statusBar === 'light' ? 'staticWhite' : 'neutral'} delay={700} />
            </View>
          )}
          allowsBackForwardNavigationGestures={canGoBack}
          // WHY: the page insets itself through --sv-inset-*, so the OS adjustment would inset twice.
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        />
      ) : (
        <View style={[styles.webview, { backgroundColor: shell.background }]} />
      )}

      {detail?.noticeBanner && noticeVisible && (
        <NoticeBanner
          title={detail.noticeBanner.title}
          subtitle={detail.noticeBanner.subtitle}
          onDismiss={dismissNotice}
          headerOverContent={headerOverContent}
          headerHeight={headerHeight}
        />
      )}

      {isBottomBar && (
        <BottomBar
          bar={collapsingBar}
          insets={insets}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          goBack={goBack}
          goForward={goForward}
          pill={pill}
          pillTone={pillTone}
        />
      )}

      <MoreSheet
        open={moreOpen}
        onDismiss={closeMore}
        showPushToggle={showPushToggle}
        masterEnabled={masterEnabled}
        pushOn={miniAppPush.isOn}
        onTogglePush={handleTogglePush}
        onRefresh={handleMenuRefresh}
      />
      <Toast
        open={miniAppPush.notice !== null}
        text={miniAppPush.notice ?? ''}
        onClose={miniAppPush.clearNotice}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: { flex: 1 },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
}));
