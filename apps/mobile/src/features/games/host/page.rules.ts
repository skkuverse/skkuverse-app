// SEE: docs/decisions/0021-host-games-and-check-their-scores-on-the-server.md §2,
// docs/explanation/in-app-games.md (Hosting a page on its game origin)
/**
 * WHY: pure, with the web view an `inject` callback, so the session machine never reads the wire and a test drives
 * the handshake with a fake one.
 */
import {
  GAME_NOTIFY_METHODS,
  GAME_PROTOCOL,
  ZERO_INSETS,
  hostBootstrapScript,
  hostDeliverScript,
  parseMessage,
  type GameNotifyMethod,
  type GameRect,
  type HostMessage,
  type Insets,
  type Viewport,
} from '@skkuverse/miniapp/protocol';
import type { GamePageMessage } from './host.rules';

/**
 * WHY: grants follow the kind, not the game: `game.*` alone, so a game cannot open a link, a place or a share
 * sheet.
 */
export const GAME_GRANTS: readonly GameNotifyMethod[] = GAME_NOTIFY_METHODS;

export type HostCommand =
  /** WHY: `sound` is null for a game that makes no sound, which has no sound button and nothing to tell. */
  | { type: 'init'; hi: number; sound: boolean | null }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'sound'; on: boolean }
  | { type: 'reset' }
  | { type: 'restart' }
  | { type: 'revive' };

export function hostedEvent(command: HostCommand): HostMessage {
  switch (command.type) {
    case 'init':
      return { event: 'game.init', data: { gameProtocol: GAME_PROTOCOL, hi: command.hi, sound: command.sound ?? false } };
    case 'sound':
      return { event: 'game.sound', data: { on: command.on } };
    default:
      return { event: `game.${command.type}`, data: {} };
  }
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * WHY: only the game's own origin loads; another site, `about:`, `data:` or the same host over http is refused, and
 * nothing goes to the OS: a game opens no links.
 */
export function isHostedNavigation(url: string, origin: string): boolean {
  return originOf(url) === origin;
}

export interface PageEvent {
  data: unknown;
  /** WHY: the URL of the document that posted, which the grant is judged on. */
  url: string | undefined;
}

export type HostedRead =
  | { kind: 'dropped' }
  /** WHY: games make no request, so one is answered `unsupported` rather than left to time out. */
  | { kind: 'reply'; message: HostMessage }
  | { kind: 'page'; message: GamePageMessage; rect: GameRect | null }
  | { kind: 'layout'; rect: GameRect };

const DROPPED: HostedRead = { kind: 'dropped' };

/**
 * WHY: the grant is decided from the posting document's origin on every message, since the page can have
 * navigated since it opened. A `{ "type": "game:over" }` has no method and never parses.
 */
export function readHostedMessage(event: PageEvent, origin: string): HostedRead {
  if (originOf(event.url) !== origin) return DROPPED;
  const msg = parseMessage(event.data);
  if (!msg) return DROPPED;
  if (msg.id !== undefined) {
    return {
      kind: 'reply',
      message: { id: msg.id, ok: false, error: { code: 'unsupported', message: `Unknown method: ${msg.method}` } },
    };
  }
  // WHY: the parser knows every method of both kinds; the grant is what keeps a mini-app method out.
  if (!(GAME_GRANTS as readonly string[]).includes(msg.method)) return DROPPED;
  switch (msg.method) {
    case 'game.ready':
      return { kind: 'page', message: { type: 'game:ready' }, rect: msg.params.rect ?? null };
    case 'game.start':
      return { kind: 'page', message: { type: 'game:start' }, rect: null };
    case 'game.phase':
      return { kind: 'page', message: { type: 'game:phase', phase: msg.params.phase }, rect: null };
    case 'game.haptic':
      return { kind: 'page', message: { type: 'game:haptic', style: msg.params.style }, rect: null };
    case 'game.layout':
      return { kind: 'layout', rect: msg.params.rect };
    case 'game.over': {
      const { score, ticks, hit, revives, revivesLeft, validator, stats, telemetry } = msg.params;
      return {
        kind: 'page',
        message: {
          type: 'game:over',
          score,
          ticks,
          hit,
          revives,
          revivesLeft,
          ...(validator !== undefined && { validator }),
          ...(stats && { stats }),
          ...(telemetry && { telemetry }),
        },
        rect: null,
      };
    }
    default:
      return DROPPED;
  }
}

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * WHY: the web view fills the screen, so the safe area is all of it; the page leaves room for the host's buttons
 * with `--sv-inset-*`.
 */
export function hostedViewport(insets: Insets): Viewport {
  return {
    safeArea: {
      top: nonNegative(insets.top),
      bottom: nonNegative(insets.bottom),
      left: nonNegative(insets.left),
      right: nonNegative(insets.right),
    },
    contentSafeArea: ZERO_INSETS,
    chrome: 'opaque',
  };
}

/**
 * QUIRK(react-native-webview): the script runs before load and again from `onLoadEnd` in whatever document
 * the view holds, and Android can hand it to a subframe, so it installs only in the top window on `origin`.
 */
export function hostedBootstrapScript(viewport: Viewport, origin: string): string {
  return hostBootstrapScript({ capabilities: GAME_GRANTS, viewport, origin });
}

export interface HostedLinkOptions {
  origin: string;
  inject(script: string): void;
  bootstrap(): string;
  onMessage(message: GamePageMessage): void;
  onLayout(rect: GameRect): void;
}

export interface HostedLink {
  /**
   * QUIRK(android): the before-load script can run on a document Android then replaces, so this injection is the
   * one that counts there.
   */
  loadEnded(): void;
  received(event: PageEvent): HostedRead['kind'];
  /** WHY: `hostDeliverScript` re-checks the origin in the page. */
  send(command: HostCommand): void;
  viewportChanged(viewport: Viewport): void;
  allows(url: string): boolean;
}

export function hostedLink({ origin, inject, bootstrap, onMessage, onLayout }: HostedLinkOptions): HostedLink {
  const deliver = (message: HostMessage) => inject(hostDeliverScript(origin, message));
  return {
    loadEnded: () => inject(bootstrap()),
    received: (event) => {
      const read = readHostedMessage(event, origin);
      switch (read.kind) {
        case 'reply':
          deliver(read.message);
          break;
        case 'page':
          // WHY: the rectangle first, so the title is placed by the time the phase shows it.
          if (read.rect) onLayout(read.rect);
          onMessage(read.message);
          break;
        case 'layout':
          onLayout(read.rect);
          break;
      }
      return read.kind;
    },
    send: (command) => deliver(hostedEvent(command)),
    viewportChanged: (viewport) => deliver({ event: 'viewport.changed', data: viewport }),
    allows: (url) => isHostedNavigation(url, origin),
  };
}

export interface PageLoad {
  failed: boolean;
  /** WHY: a retry mounts a fresh web view, which loads `entryUrl` again from scratch. */
  attempt: number;
}

export type PageLoadEvent = { type: 'error' } | { type: 'httpError'; status: number } | { type: 'retry' };

export const initialPageLoad: PageLoad = { failed: false, attempt: 0 };

/** WHY: nothing else changes it: no run can start on a page that never loaded, since none said `game.ready`. */
export function pageLoadAfter(s: PageLoad, e: PageLoadEvent): PageLoad {
  switch (e.type) {
    case 'error':
      return s.failed ? s : { ...s, failed: true };
    case 'httpError':
      return e.status >= 400 && !s.failed ? { ...s, failed: true } : s;
    case 'retry':
      return { failed: false, attempt: s.attempt + 1 };
  }
}
