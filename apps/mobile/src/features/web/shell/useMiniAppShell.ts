import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { getMiniAppOrigins, resolveMiniAppUrl, useNotificationStore } from '@skkuverse/shared';
import { GLASS_AVAILABLE } from '@skkuverse/sds';
import { DEFAULT_SHELL, mergeShell, type ShellPatch } from '@skkuverse/miniapp/protocol';
import { useMiniAppPush } from '@/features/notifications/useMiniAppPush';
import { hasMiniAppPushToggle } from '@/features/notifications/notifications.constants';
import { normalizeWebUrl } from '../web-url.rules';
import { useClock } from '@/platform/clock';
import { track, useViewTracking } from '@/platform/analytics';
import { asEntrySource } from '@/platform/analytics.rules';
import { bumpUsage } from '@/platform/usage-counters';
import { useMiniAppDetail } from '../useMiniAppDetail';
import { useMiniAppIndex } from '../useMiniAppIndex';
import { toMiniAppOwnOrigins, toMiniAppPinnedOrigins, type NavRequest } from '../navigation.rules';
import { handOffMiniAppLinks } from '../web.service';
import { toMiniAppScreenPill } from './pill.rules';
import { computeViewport } from './viewport.rules';
import { useMiniAppBridge } from './components/useMiniAppBridge';
import { useMiniAppSession } from './components/useMiniAppSession';
import { useSwipeGuard } from './components/useSwipeGuard';

const NO_CLOCK_EDGE = (): null => null;

export function useMiniAppShell(
  params: { id?: string; path?: string; source?: string },
  layout: { insets: EdgeInsets; bottomBarHeight: number },
) {
  // WHY: only the id and a path cross the route; name, start URL and logo come from the registry.
  // SEE: docs/explanation/miniapp-shell.md ("Opening a mini app: an id, never a URL")
  const miniAppId = params.id;
  // WHY: for an anonymous user this toggle is the only way to turn the push off.
  // SEE: docs/explanation/miniapp-shell.md ("The push toggle")
  const pushMiniAppId = miniAppId ?? '';
  const miniAppPush = useMiniAppPush(pushMiniAppId);
  const masterEnabled = useNotificationStore((s) => s.preferences.enabled);
  // WHY: no timer; a push window ends days apart from any one shell visit, and a return to the app rereads.
  const now = useClock(NO_CLOCK_EDGE);
  const showPushToggle = hasMiniAppPushToggle(miniAppId, now, miniAppPush.isOn) && !!miniAppPush.uid;
  const [moreOpen, setMoreOpen] = useState(false);
  const handleTogglePush = useCallback(
    (next: boolean) => {
      // WHY: close the sheet first, or the result toast and a permission dialog sit behind it.
      setMoreOpen(false);
      if (next) miniAppPush.turnOn('toggle');
      else miniAppPush.turnOff('toggle');
    },
    [miniAppPush],
  );
  useViewTracking('miniapp', miniAppId ?? null, asEntrySource(params.source), (id) => ({
    nth: bumpUsage(`miniapp:${id}`),
    nth_all: bumpUsage('miniapp'),
  }));

  const { markLoad, recordBridgeCall } = useMiniAppSession(miniAppId);
  const logAction = useCallback(
    (action: 'link' | 'map' | 'miniapp' | 'nav_back' | 'nav_forward' | 'menu' | 'refresh' | 'dismiss', target?: string) => {
      track('item_action', { view: 'miniapp', item_id: miniAppId, action, target });
    },
    [miniAppId],
  );

  const { data: detail } = useMiniAppDetail(miniAppId);
  // SEE: docs/explanation/miniapp-shell.md ("Shell: the registry decides the chrome")
  const [shellPatch, setShellPatch] = useState<ShellPatch>({});
  const shell = useMemo(
    () => mergeShell(detail?.shell ?? DEFAULT_SHELL, shellPatch),
    [detail?.shell, shellPatch],
  );
  // WHY: null until the detail arrives; assuming 'bottom' flashed the bar on a 'top' mini app.
  const bar = detail ? shell.bar : null;
  const isBottomBar = bar === 'bottom';
  const isOverlay = shell.header === 'overlay';
  const { data: index } = useMiniAppIndex();
  const entry = useMemo(
    () => (miniAppId ? index?.find((e) => e.id === miniAppId) : undefined),
    [index, miniAppId],
  );

  // QUIRK(ios): ATS blocks cleartext http (-1022), and the server-owned registry can hold one.
  // SEE: docs/explanation/miniapp-shell.md ("Opening a mini app: an id, never a URL")
  const startUrl = detail?.startUrl ? normalizeWebUrl(detail.startUrl).url : '';
  const resolvedUrl = startUrl ? resolveMiniAppUrl(startUrl, params.path) : '';
  // WHY: pinned once known; a refetch's slightly different startUrl would reload the page.
  // Set during render, the derived-state pattern, because an effect lands a frame late.
  const [pinnedUrl, setPinnedUrl] = useState('');
  if (!pinnedUrl && resolvedUrl) setPinnedUrl(resolvedUrl);
  const initialUrl = pinnedUrl || resolvedUrl;
  const serviceName = entry?.name ?? '';
  const shellLogo = entry?.shellLogo ?? null;

  const webRef = useRef<WebView>(null);

  // WHY: the swipe guard's header height, not useHeaderHeight(), which drops to 0 mid-swipe.
  // SEE: docs/explanation/miniapp-shell.md ("The iOS back swipe: the WebView's frame stays put")
  const { headerHeight, onScrollY, onLoadStart } = useSwipeGuard(webRef);
  const { insets, bottomBarHeight } = layout;
  const viewport = useMemo(
    () =>
      computeViewport({
        shell,
        insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
        headerHeight,
        bottomBarHeight,
        glassAvailable: GLASS_AVAILABLE,
      }),
    [shell, insets.top, insets.bottom, insets.left, insets.right, headerHeight, bottomBarHeight],
  );

  // WHY: read as a fallback to initialUrl rather than set by an effect, a frame late.
  const [navigatedUrl, setNavigatedUrl] = useState('');
  const currentUrl = navigatedUrl || initialUrl;
  const source = useMemo(() => ({ uri: initialUrl }), [initialUrl]);
  const [pageTitle, setPageTitle] = useState(serviceName);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  // WHY: mirrored in a ref so the Android back handler reads it without resubscribing.
  const canGoBackRef = useRef(false);

  const [noticeVisible, setNoticeVisible] = useState(true);

  // WHY: the pill names the registry's app only on the app's own origins, and the shell keeps
  // other origins' pages out of the web view.
  const ownOrigins = useMemo(
    () => toMiniAppOwnOrigins(initialUrl, miniAppId, getMiniAppOrigins()),
    [initialUrl, miniAppId],
  );
  const pinnedOrigins = useMemo(
    () => toMiniAppPinnedOrigins(initialUrl, miniAppId, getMiniAppOrigins()),
    [initialUrl, miniAppId],
  );
  const pill = useMemo(
    () => toMiniAppScreenPill({ currentUrl, ownOrigins, name: serviceName, logo: shellLogo, pageTitle }),
    [currentUrl, ownOrigins, serviceName, shellLogo, pageTitle],
  );
  const onShouldStartLoad = useCallback(
    (request: NavRequest) => handOffMiniAppLinks(request, pinnedOrigins),
    [pinnedOrigins],
  );

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setNavigatedUrl(nav.url);
      setCanGoBack(nav.canGoBack);
      canGoBackRef.current = nav.canGoBack;
      setCanGoForward(nav.canGoForward);
      if (nav.title) setPageTitle((prev) => (serviceName ? prev : nav.title));
    },
    [serviceName],
  );

  const { handleMessage, bootstrapScript } = useMiniAppBridge({
    webRef,
    miniAppId,
    initialUrl,
    currentUrl,
    viewport,
    logAction,
    markLoad,
    setShellPatch,
    recordBridgeCall,
  });

  // QUIRK(android): back walks the WebView's history first and closes the shell only at its
  // root; iOS hands the edge swipe to WKWebView instead (the screen's gestureEnabled).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const goBack = useCallback(() => {
    logAction('nav_back');
    webRef.current?.goBack();
  }, [logAction]);
  const goForward = useCallback(() => {
    logAction('nav_forward');
    webRef.current?.goForward();
  }, [logAction]);

  const openMore = useCallback(() => {
    logAction('menu');
    setMoreOpen(true);
  }, [logAction]);

  const handleMenuRefresh = useCallback(() => {
    logAction('refresh');
    setMoreOpen(false);
    webRef.current?.reload();
  }, [logAction]);

  const closeMore = () => setMoreOpen(false);
  const dismissNotice = () => {
    logAction('dismiss', 'notice_banner');
    setNoticeVisible(false);
  };

  return {
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
    onNavChange,
    handleMessage,
    bootstrapScript,
    markLoad,
    goBack,
    goForward,
    openMore,
    handleMenuRefresh,
    onShouldStartLoad,
  };
}
