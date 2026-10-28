import { useRef, useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import type {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewProps,
} from 'react-native-webview';
import { getBridgeOrigins, getMiniAppOrigins, toBrowserUrl } from '@skkuverse/shared';
import { parseWebMessage } from '@skkuverse/bridge';
import { resolveWebviewCapabilities } from '../capabilities.rules';
import { handOffAppLinks, openAppFirst, performWebAction } from '../web.service';
import { OPENABLE_APP_SCHEMES } from '../../../../config/external-apps';
import { playWebHaptic } from '@/platform/haptics';
import { openExternalUrl } from '@/platform/handoff';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function useWebBrowser({ title, url }: { title?: string; url?: string }) {
  const webViewRef = useRef<WebView>(null);

  // WHY: the page's own <title> is used only when the caller supplied no title.
  const [pageTitle, setPageTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // WHY: this shell hosts multi-page sites (notice originals and their links),
  // where "back" means the previous page, not "close the screen".
  const [canGoBack, setCanGoBack] = useState(false);
  // WHY: mirrored in a ref so the Android BackHandler reads the live value
  // without resubscribing on every navigation.
  const canGoBackRef = useRef(false);

  // WHY: null when the param is refused; the screen then leaves for home.
  const startUrl = toBrowserUrl(url);

  // WHY: param → page <title> → host. Notice originals and markdown links pass
  // no title, so the page names itself rather than showing a blank bar.
  const headerTitle = title || pageTitle || hostOf(startUrl ?? '');

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    if (nav.title) setPageTitle(nav.title);
    setCanGoBack(nav.canGoBack);
    canGoBackRef.current = nav.canGoBack;
  }, []);

  // QUIRK(android): system and gesture back walk the page history first, and
  // close the screen only at the root. iOS gets this from the gesture handoff.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const msg = parseWebMessage(event.nativeEvent.data);
    if (!msg) return;

    // WHY: re-resolved on every message against the document that posted it, so
    // a page that navigates onward never keeps its opener's grant.
    const granted = resolveWebviewCapabilities(
      event.nativeEvent.url,
      getBridgeOrigins(),
      getMiniAppOrigins(),
    );
    if (!granted.includes(msg.type)) return;

    switch (msg.type) {
      case 'web:open-url':
        void openAppFirst(msg, openExternalUrl, OPENABLE_APP_SCHEMES);
        break;
      case 'web:haptic':
        playWebHaptic(msg.style);
        break;
      case 'web:map-select':
        // WHY: ignored. Only the first-party map pages send it, and the server
        // no longer routes to them.
        break;
      case 'web:action':
        performWebAction(msg.actionType, msg.actionValue, 'webview');
        break;
    }
  }, []);

  const reload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // QUIRK(react-native-webview): fires only for the main frame
  // (RNCWebViewClient `isForMainFrame`), so a 404'd image never fails the page.
  const onHttpError: NonNullable<WebViewProps['onHttpError']> = ({ nativeEvent }) => {
    if (nativeEvent.statusCode >= 400) setFailed(true);
  };

  return {
    webViewRef,
    startUrl,
    headerTitle,
    canGoBack,
    loading,
    failed,
    onNavigationStateChange,
    handleMessage,
    reload,
    // WHY: every navigation goes through handOffAppLinks, not the library's own
    // canOpenURL → openURL, which would let any page launch a declared app on load.
    onShouldStartLoadWithRequest: handOffAppLinks,
    onLoadStart: () => setLoading(true),
    onLoadEnd: () => setLoading(false),
    onError: () => {
      setLoading(false);
      setFailed(true);
    },
    onHttpError,
  };
}
