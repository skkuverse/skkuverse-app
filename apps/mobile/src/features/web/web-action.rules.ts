/**
 * WHY: a page is anything its host ever serves, so it gets only `map` and `miniapp`, whose anchored id grammars
 * name a thing, never a destination; `route`, `webview` and `external` would name any screen or URL. The origin
 * gate decides who may ask; this decides what. SEE: docs/decisions/0006-miniapp-webview-push-architecture.md
 */
import { parseMapPlaceRef, parseMiniAppTarget } from '@skkuverse/shared';

export const WEB_ACTION_TYPES = ['map', 'miniapp'] as const;

export type WebActionType = (typeof WEB_ACTION_TYPES)[number];

export interface WebAction {
  actionType: WebActionType;
  actionValue: string;
}

export function resolveWebAction(actionType: unknown, actionValue: unknown): WebAction | null {
  if (typeof actionValue !== 'string') return null;
  switch (actionType) {
    case 'map':
      return parseMapPlaceRef(actionValue) ? { actionType, actionValue } : null;
    case 'miniapp':
      return parseMiniAppTarget(actionValue) ? { actionType, actionValue } : null;
    default:
      return null;
  }
}

/**
 * WHY: a build too old for `web:action` lists nothing, so its pages show no dead button. It advertises, never
 * grants.
 */
export const WEB_BRIDGE_ADVERTISEMENT_JS = `(function () {
  var host = window.skkuverse || (window.skkuverse = {});
  host.bridge = Object.freeze({ actions: Object.freeze(${JSON.stringify(WEB_ACTION_TYPES)}) });
})();
true;`;
