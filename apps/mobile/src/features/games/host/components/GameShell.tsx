import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';
import { sameViewport, type GameRect } from '@skkuverse/miniapp/protocol';
import { ResultSection, createThemedStyles } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import type { GamePage } from '../../games.types';
import type { GamePageMessage } from '../host.rules';
import {
  hostedBootstrapScript,
  hostedLink,
  hostedViewport,
  initialPageLoad,
  pageLoadAfter,
  type HostCommand,
} from '../page.rules';

export interface GameShellHandle {
  send(command: HostCommand): void;
}

interface Props {
  page: GamePage;
  background: string;
  keyboard: boolean;
  onMessage(message: GamePageMessage): void;
  onLayout(rect: GameRect): void;
  onLeave(): void;
}

function stageProps(background: string, keyboard: boolean): WebViewProps {
  return {
    style: [styles.web, { backgroundColor: background }],
    containerStyle: { backgroundColor: background },
    scrollEnabled: false,
    bounces: false,
    overScrollMode: 'never',
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    automaticallyAdjustContentInsets: false,
    contentInsetAdjustmentBehavior: 'never',
    setSupportMultipleWindows: false,
    allowsLinkPreview: false,
    // WHY: a typing game needs the text system for its input (caret, IME); any other must never select text under a
    // long press.
    textInteractionEnabled: keyboard,
    // QUIRK(ios): the Done bar above the keyboard takes height the game needs.
    hideKeyboardAccessoryView: keyboard,
    domStorageEnabled: false,
    androidLayerType: 'hardware',
    webviewDebuggingEnabled: __DEV__,
  };
}

/**
 * WHY: the route has already checked `origin` is the one `games.origins` maps to this game. The page hears
 * only `game.*` from that origin, granted per message, and may not leave it. A failed load never said ready,
 * so no run started.
 */
export const GameShell = forwardRef<GameShellHandle, Props>(function GameShell(
  { page: { entryUrl, origin }, background, keyboard, onMessage, onLayout, onLeave },
  ref,
) {
  const styles = useStyles();
  const { t } = useT();
  const webRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const viewport = useMemo(
    () => hostedViewport({ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }),
    [insets.top, insets.bottom, insets.left, insets.right],
  );
  const bootstrap = useMemo(() => hostedBootstrapScript(viewport, origin), [viewport, origin]);
  const [load, dispatchLoad] = useReducer(pageLoadAfter, initialPageLoad);

  const latest = useRef({ bootstrap, onMessage, onLayout });
  useLayoutEffect(() => {
    latest.current = { bootstrap, onMessage, onLayout };
  });
  const link = useMemo(
    () =>
      hostedLink({
        origin,
        inject: (script) => webRef.current?.injectJavaScript(script),
        bootstrap: () => latest.current.bootstrap,
        onMessage: (m) => latest.current.onMessage(m),
        onLayout: (rect) => latest.current.onLayout(rect),
      }),
    [origin],
  );

  const delivered = useRef(viewport);
  useEffect(() => {
    if (sameViewport(delivered.current, viewport)) return;
    delivered.current = viewport;
    link.viewportChanged(viewport);
  }, [viewport, link]);

  useImperativeHandle(ref, () => ({ send: link.send }), [link]);

  const source = useMemo(() => ({ uri: entryUrl }), [entryUrl]);

  return (
    <View style={styles.stage}>
      <WebView
        // WHY: a failed first load leaves nothing to reload, so a retry mounts a fresh web view.
        key={load.attempt}
        ref={webRef}
        source={source}
        // WHY: every URL reaches `allows`, which refuses all but the game's origin; a URL outside
        // this list would instead be handed to the OS (Linking), and a game opens nothing.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(req) => link.allows(req.url)}
        onMessage={(e) => link.received(e.nativeEvent)}
        {...stageProps(background, keyboard)}
        injectedJavaScriptBeforeContentLoaded={bootstrap}
        onLoadEnd={link.loadEnded}
        onError={() => dispatchLoad({ type: 'error' })}
        // QUIRK(react-native-webview): fires only for the main frame, so a missing asset never fails the page.
        onHttpError={({ nativeEvent }) => dispatchLoad({ type: 'httpError', status: nativeEvent.statusCode })}
        // QUIRK(react-native-webview): the page's process can be killed under memory pressure (an ad is a likely
        // moment); a reload brings back game.ready.
        onContentProcessDidTerminate={() => webRef.current?.reload()}
        onRenderProcessGone={() => webRef.current?.reload()}
      />
      {load.failed && (
        <View style={styles.failed}>
          <ResultSection
            title={t('game.loadFailed')}
            description={t('error.checkNetwork')}
            primaryActionProps={{ children: t('common.retry'), onPress: () => dispatchLoad({ type: 'retry' }) }}
            secondaryActionProps={{ children: t('common.close'), onPress: onLeave }}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  web: { flex: 1 },
});

const useStyles = createThemedStyles(({ color }) => ({
  stage: { flex: 1 },
  // WHY: the failure state is the app's, not the game's, so it sits on the app's surface over the fixed game
  // palette.
  failed: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.layerFloating,
  },
}));
