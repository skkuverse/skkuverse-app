import { asMember } from './allowlist';

/**
 * WHY: `'unknown'` is a client-side sentinel the server never sends, so a value this build cannot
 * read lands on no real behaviour.
 */
export type ActionType =
  | 'content'
  | 'route'
  | 'webview'
  | 'external'
  | 'miniapp'
  | 'map'
  | 'unknown';

/** WHY: `'unknown'` is deliberately absent. */
const WIRE_ACTION_TYPES = [
  'content',
  'route',
  'webview',
  'external',
  'miniapp',
  'map',
] as const;

/**
 * WHY: an unknown value becomes `'unknown'`, never `'external'`: doing nothing is recoverable, opening
 * an arbitrary string is not. `"url"` is another spelling of `"external"`.
 */
export function parseActionType(raw: unknown): ActionType {
  if (raw === 'url') return 'external';
  return asMember(raw, WIRE_ACTION_TYPES) ?? 'unknown';
}

/**
 * WHY: `content` renders in place, `unknown` does nothing, and `miniapp` resolves to the mini-app kind
 * on its own path, so none of them reaches the dispatcher.
 */
export const NAVIGABLE_ACTION_TYPES = ['route', 'webview', 'external'] as const;

export type NavigableActionType = (typeof NAVIGABLE_ACTION_TYPES)[number];
