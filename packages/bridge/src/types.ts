// CONTRACT(skkuverse-web): the app owns this file; skkuverse-web/packages/bridge/src/types.ts vendors it byte for byte
// and the umbrella's contract registry checks its hash (`bridge.message-types`), so edit the app's copy, never that one.
// WHY: the generic web view's channel only; a mini app speaks `@skkuverse/miniapp/protocol`, a separate contract.

export type AppToWebMessage =
  | { type: 'app:auth-token'; token: string }
  | { type: 'app:navigate'; path: string }
  | { type: 'app:theme-changed'; theme: 'light' | 'dark' }
  | { type: 'app:locale-changed'; locale: string };

export interface MapSelectPayload {
  action: 'add' | 'delete';
  placename: string;
  buildingname: string;
  previousplace: string | null;
  afterplace: string | null;
  placeinfo: string | null;
  time: string | null;
  leftColor: string;
  rightColor: string;
}

export type WebToAppMessage =
  | { type: 'web:ready' }
  | { type: 'web:navigate'; path: string }
  | { type: 'web:analytics'; event: string; params?: Record<string, unknown> }
  | { type: 'web:haptic'; style: 'light' | 'medium' | 'heavy' }
  // WHY: a host that predates `appUrl` ignores it and opens `url`, so a page may always send it.
  | { type: 'web:open-url'; url: string; appUrl?: string }
  | { type: 'web:map-select'; payload: MapSelectPayload }
  // WHY: feature-detect accepted actions via `window.skkuverse?.bridge?.actions`.
  | { type: 'web:action'; actionType: string; actionValue: string };
