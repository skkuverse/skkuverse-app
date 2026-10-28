// SEE: docs/explanation/miniapp-shell.md ("Dispatch: one message in, at most one effect out")
import {
  parseMessage,
  type HapticStyle,
  type HostMessage,
  type ShellPatch,
} from '@skkuverse/miniapp/protocol';

export interface MiniAppEffects {
  haptic(style: HapticStyle): void;
  openLink(target: { url: string; appUrl?: string }): void;
  performAction(actionType: 'map' | 'miniapp', actionValue: string): void;
  share(target: { url: string; text?: string }): void;
  track(event: string, params?: Record<string, unknown>): void;
  ready(): void;
  setShell(patch: ShellPatch): void;
  deliver(origin: string, message: HostMessage): void;
}

export interface PageEvent {
  data: unknown;
  /** WHY: the URL of the document that posted, which the grant is judged on. */
  url: string | undefined;
}

export type DispatchOutcome = 'dropped' | 'denied' | 'unsupported' | 'handled';

export function pageOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** WHY: `granted` is resolved per message from the posting document (`resolveMiniAppCapabilities`). */
export function dispatchMiniAppMessage(
  event: PageEvent,
  granted: readonly string[],
  effects: MiniAppEffects,
): DispatchOutcome {
  const msg = parseMessage(event.data);
  if (!msg) return 'dropped';

  if (msg.id !== undefined) {
    // WHY: a response goes only to the asking origin; with none usable there is nowhere safe
    // to send it, and hostDeliverScript re-checks it in the page anyway.
    const origin = pageOrigin(event.url);
    const code = granted.length === 0 ? 'denied' : 'unsupported';
    if (origin) {
      effects.deliver(origin, {
        id: msg.id,
        ok: false,
        error: {
          code,
          message:
            code === 'denied'
              ? 'This page is not granted the skkuverse bridge.'
              : `Unknown method: ${msg.method}`,
        },
      });
    }
    return code;
  }

  if (!granted.includes(msg.method)) return 'dropped';

  switch (msg.method) {
    case 'haptic.impact':
      effects.haptic(msg.params.style);
      break;
    case 'link.open':
      effects.openLink(msg.params);
      break;
    case 'map.openPlace':
      effects.performAction('map', msg.params.place);
      break;
    case 'miniapp.open':
      effects.performAction('miniapp', msg.params.target);
      break;
    case 'share.open':
      effects.share(msg.params);
      break;
    case 'analytics.track':
      effects.track(msg.params.event, msg.params.params);
      break;
    case 'app.ready':
      effects.ready();
      break;
    case 'shell.set':
      effects.setShell(msg.params);
      break;
    default:
      // WHY: a method the protocol parses but this build does not handle; reachable only if
      // `granted` lists more than this switch covers.
      return 'dropped';
  }
  return 'handled';
}
