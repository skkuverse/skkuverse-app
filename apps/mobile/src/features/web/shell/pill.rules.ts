import type { ShellStatusBar } from '@skkuverse/miniapp/protocol';
import type { Logo } from '@skkuverse/shared';
import { faviconUrl } from './favicon.rules';

/** WHY: `app` shows only on the app's own origin, so a page elsewhere cannot borrow the app's name. */
export interface MiniAppScreenPill {
  kind: 'app' | 'site';
  name: string;
  logo: Logo | null;
  faviconUri: string | null;
}

export interface ToMiniAppScreenPillInputs {
  currentUrl: string;
  ownOrigins: readonly string[];
  name: string;
  logo: Logo | null;
  /** WHY: stands in for a missing name on the app's own origin only. */
  pageTitle: string;
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function toMiniAppScreenPill(inputs: ToMiniAppScreenPillInputs): MiniAppScreenPill {
  const { currentUrl, ownOrigins, name, logo, pageTitle } = inputs;
  const url = parse(currentUrl);
  if (url && ownOrigins.includes(url.origin)) {
    return { kind: 'app', name: name || pageTitle, logo, faviconUri: faviconUrl(currentUrl) };
  }
  return { kind: 'site', name: url?.host ?? '', logo: null, faviconUri: null };
}

export type PillLabelTone = 'neutral' | 'staticWhite';

/** WHY: glass shows the page through it, while the solid fallback is a layer in the device's scheme. */
export function pillLabelTone(statusBar: ShellStatusBar, glass: boolean): PillLabelTone {
  return glass && statusBar === 'light' ? 'staticWhite' : 'neutral';
}
