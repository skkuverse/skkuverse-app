/**
 * WHY: grants are resolved per message from the posting document's origin, never from the opener: a web
 * view navigates, and the allowlist is server-owned. Fails closed (no config, unparseable URL, unmatched
 * origin read as none). SEE: docs/explanation/miniapp-shell.md ("The origin gate: re-decided per message")
 */
import type { WebToAppMessage } from '@skkuverse/bridge';
import { NOTIFY_METHODS, type MiniappNotifyMethod } from '@skkuverse/miniapp/protocol';

export type WebMessageType = WebToAppMessage['type'];

/**
 * WHY: `web:navigate` stays absent; it was an unguarded `router.push` sink, so re-add it only with a path
 * allowlist. `web:action` carries ids the app resolves (`resolveWebAction`), never a route or a URL, and
 * `web:haptic` can only buzz the phone.
 */
export const FIRST_PARTY_CAPABILITIES: readonly WebMessageType[] = [
  'web:open-url',
  'web:map-select',
  'web:action',
  'web:haptic',
];

const NONE: readonly WebMessageType[] = [];
const NO_METHODS: readonly MiniappNotifyMethod[] = [];

export function bridgedOrigin(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (!pageUrl || allowedOrigins.length === 0) return null;
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }
  // QUIRK(whatwg-url): an opaque origin (data:, a sandboxed frame) reads as the string "null"; never match it.
  if (origin === 'null') return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

/** WHY: a mini-app origin speaks to its own shell only, so it gets nothing in /webview. */
export function resolveWebviewCapabilities(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
  miniAppOrigins: Readonly<Record<string, string>>,
): readonly WebMessageType[] {
  const origin = bridgedOrigin(pageUrl, allowedOrigins);
  return origin && miniAppOrigins[origin] === undefined ? FIRST_PARTY_CAPABILITIES : NONE;
}

/**
 * WHY: all or nothing, since the curated phase has one trust level, and only the app's own origins: a
 * sibling mini app gets nothing in another app's shell. Typed as the mini-app methods alone, so no
 * `game.*` method is ever granted here; a game origin's grants are the game host's.
 */
export function resolveMiniAppCapabilities(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
  miniAppOrigins: Readonly<Record<string, string>>,
  miniAppId: string | undefined,
): readonly MiniappNotifyMethod[] {
  const origin = bridgedOrigin(pageUrl, allowedOrigins);
  return origin && miniAppId && miniAppOrigins[origin] === miniAppId ? NOTIFY_METHODS : NO_METHODS;
}
