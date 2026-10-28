import { useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Platform } from 'react-native';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getBridgeOrigins, getMiniAppOrigins } from '@skkuverse/shared';
import {
  hostBootstrapScript,
  hostDeliverScript,
  sameViewport,
  type HostMessage,
  type ShellPatch,
  type Viewport,
} from '@skkuverse/miniapp/protocol';
import { playWebHaptic } from '@/platform/haptics';
import { logMiniAppEvent, track } from '@/platform/analytics';
import { openExternalUrl, shareContent } from '@/platform/handoff';
import { OPENABLE_APP_SCHEMES } from '../../../../../config/external-apps';
import { resolveMiniAppCapabilities } from '../../capabilities.rules';
import { openAppFirst, performWebAction } from '../../web.service';
import { dispatchMiniAppMessage, pageOrigin, type DispatchOutcome, type MiniAppEffects } from '../bridge.rules';

interface UseMiniAppBridgeInputs {
  webRef: RefObject<WebView | null>;
  miniAppId: string | undefined;
  initialUrl: string;
  currentUrl: string;
  viewport: Viewport;
  logAction: (action: 'link' | 'map' | 'miniapp', target?: string) => void;
  markLoad: (outcome: 'ready') => void;
  setShellPatch: Dispatch<SetStateAction<ShellPatch>>;
  recordBridgeCall: (data: unknown, outcome: DispatchOutcome) => void;
}

export function useMiniAppBridge({
  webRef,
  miniAppId,
  initialUrl,
  currentUrl,
  viewport,
  logAction,
  markLoad,
  setShellPatch,
  recordBridgeCall,
}: UseMiniAppBridgeInputs) {
  // SEE: docs/explanation/miniapp-shell.md ("The origin gate: re-decided per message")
  const deliver = useCallback((origin: string, message: HostMessage) => {
    webRef.current?.injectJavaScript(hostDeliverScript(origin, message));
  }, [webRef]);

  const effects = useMemo<MiniAppEffects>(
    () => ({
      haptic: playWebHaptic,
      openLink: (target) => {
        logAction('link', pageOrigin(target.url) ?? undefined);
        void openAppFirst(target, openExternalUrl, OPENABLE_APP_SCHEMES);
      },
      performAction: (actionType, actionValue) => {
        logAction(actionType, actionValue);
        performWebAction(actionType, actionValue, 'miniapp');
      },
      // QUIRK(android): ACTION_SEND drops `url`, so it joins the message; iOS needs it apart
      // for the link card. The notice detail shares the same way.
      share: ({ url, text }) => {
        track('item_action', { view: 'miniapp', item_id: miniAppId, action: 'share', target: url });
        void shareContent(
          Platform.OS === 'ios' ? { url, message: text } : { message: text ? `${text}\n${url}` : url },
        ).catch(() => {});
      },
      track: (event, params) => {
        if (miniAppId) logMiniAppEvent({ miniAppId, event, params });
      },
      ready: () => markLoad('ready'),
      setShell: (patch) => setShellPatch((prev) => ({ ...prev, ...patch })),
      deliver,
    }),
    [miniAppId, deliver, logAction, markLoad, setShellPatch],
  );

  // WHY: the grant is re-decided per message from the sender's origin, never at open time.
  // SEE: docs/explanation/miniapp-shell.md ("The origin gate: re-decided per message")
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { data, url } = event.nativeEvent;
      const outcome = dispatchMiniAppMessage(
        { data, url },
        resolveMiniAppCapabilities(url, getBridgeOrigins(), getMiniAppOrigins(), miniAppId),
        effects,
      );
      recordBridgeCall(data, outcome);
    },
    [effects, miniAppId, recordBridgeCall],
  );

  // WHY: the advertised list comes from the start URL and is no grant; the gate above decides.
  // SEE: docs/explanation/miniapp-shell.md ("What a page finds before its own script runs")
  const advertisedCapabilities = useMemo(
    () => resolveMiniAppCapabilities(initialUrl, getBridgeOrigins(), getMiniAppOrigins(), miniAppId),
    [initialUrl, miniAppId],
  );
  // WHY: gated to the start URL's origin, so `window.skkuverse` is never installed on another page.
  const appOrigin = pageOrigin(initialUrl);
  const bootstrapScript = useMemo(
    () => (appOrigin ? hostBootstrapScript({ capabilities: advertisedCapabilities, viewport, origin: appOrigin }) : ''),
    [advertisedCapabilities, viewport, appOrigin],
  );

  // SEE: docs/explanation/miniapp-shell.md ("What a page finds before its own script runs")
  const deliveredViewport = useRef<Viewport | null>(null);
  useEffect(() => {
    const prev = deliveredViewport.current;
    deliveredViewport.current = viewport;
    if (!prev || sameViewport(prev, viewport)) return;
    const origin = pageOrigin(currentUrl);
    if (origin) deliver(origin, { event: 'viewport.changed', data: viewport });
  }, [viewport, currentUrl, deliver]);

  return { handleMessage, bootstrapScript };
}
