/**
 * WHY: the web views pass `originWhitelist={['*']}`, or react-native-webview would hand any non-web URL to
 * `openURL` itself, letting a page launch a declared app on load. Only web documents load; a top-frame
 * URL reaches the OS only when `isOpenableUrl` allows it, an iframe never.
 */

export type NavDecision =
  | { kind: 'load' }
  | { kind: 'open'; url: string; fallback?: string }
  | { kind: 'block' };

export interface NavRequest {
  url: string;
  isTopFrame?: boolean;
}

export interface AppAllowlist {
  schemes: readonly string[];
  packages: readonly string[];
}

const WEB_SCHEMES = new Set(['http', 'https', 'about', 'data', 'blob']);
const OS_SCHEMES = new Set(['tel', 'mailto', 'sms']);
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

const LOAD: NavDecision = { kind: 'load' };
const BLOCK: NavDecision = { kind: 'block' };

export function schemeOf(url: string): string | null {
  const match = SCHEME_RE.exec(url.trim());
  return match ? match[1]!.toLowerCase() : null;
}

export function decideNavigation(request: NavRequest, apps: AppAllowlist): NavDecision {
  const url = request.url.trim();
  const scheme = schemeOf(url);
  if (!scheme) return BLOCK;
  if (WEB_SCHEMES.has(scheme)) return LOAD;
  if (request.isTopFrame === false) return BLOCK;
  if (scheme === 'intent') return fromIntentUri(url, apps);
  return isOpenableUrl(url, apps.schemes) ? { kind: 'open', url } : BLOCK;
}

function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** WHY: the start URL's origin counts only when the map names no app for it, so a sibling app's origin adds nothing. */
export function toMiniAppOwnOrigins(
  startUrl: string,
  miniAppId: string | undefined,
  miniAppOrigins: Readonly<Record<string, string>>,
): readonly string[] {
  const own = Object.keys(miniAppOrigins).filter((origin) => miniAppOrigins[origin] === miniAppId);
  const start = originOf(startUrl);
  if (start && !Object.hasOwn(miniAppOrigins, start)) own.push(start);
  return own;
}

/**
 * WHY: an app with no bridge (one on a university host) is not pinned, so a sign-in hop across that host's siblings
 * stays in the shell.
 */
export function toMiniAppPinnedOrigins(
  startUrl: string,
  miniAppId: string | undefined,
  miniAppOrigins: Readonly<Record<string, string>>,
): readonly string[] {
  return toMiniAppOwnOrigins(startUrl, miniAppId, miniAppOrigins).filter((origin) => Object.hasOwn(miniAppOrigins, origin));
}

/**
 * QUIRK(react-native-webview): pinning holds on iOS only; Android flags no frame and lets a load through
 * when JS has not answered in 250 ms, so there the pill following the current origin holds.
 */
export function decideMiniAppNavigation(
  request: NavRequest,
  apps: AppAllowlist,
  ownOrigins: readonly string[],
): NavDecision {
  const url = request.url.trim();
  const scheme = schemeOf(url);
  const isPage = scheme === 'http' || scheme === 'https';
  // QUIRK(android): no frame flag is sent, and pinning there would send off-origin iframes to the browser.
  if (!isPage || request.isTopFrame !== true || ownOrigins.length === 0) return decideNavigation(request, apps);
  const origin = originOf(url);
  return origin && ownOrigins.includes(origin) ? LOAD : { kind: 'open', url };
}

const INTENT_MARKER = '#Intent;';

/**
 * QUIRK(react-native): `openURL` passes the string to `Uri.parse`, never `Intent.parseUri`, so an `intent://`
 * link is read here; its scheme and package must be a declared app's, and its fallback is kept only when https.
 */
function fromIntentUri(url: string, apps: AppAllowlist): NavDecision {
  const marker = url.indexOf(INTENT_MARKER);
  if (marker < 0) return BLOCK;
  const rest = url.slice('intent:'.length, marker);

  const extras = new Map<string, string>();
  for (const part of url.slice(marker + INTENT_MARKER.length).split(';')) {
    if (part === 'end') break;
    const eq = part.indexOf('=');
    if (eq > 0) extras.set(part.slice(0, eq), part.slice(eq + 1));
  }

  const target = extras.get('scheme')?.toLowerCase();
  const pkg = extras.get('package');
  if (!target || !pkg || !apps.schemes.includes(target) || !apps.packages.includes(pkg)) {
    return BLOCK;
  }

  const open = `${target}:${rest}`;
  const fallback = decodeOrNull(extras.get('S.browser_fallback_url'));
  return fallback && schemeOf(fallback) === 'https'
    ? { kind: 'open', url: open, fallback }
    : { kind: 'open', url: open };
}

/** WHY: `maps` is Apple Maps, which first-party bus pages open on a tap; opening it needs no query declaration. */
const PAGE_OPEN_SCHEMES = new Set(['http', 'https', ...OS_SCHEMES, 'maps']);

/** WHY: a page may never hand the OS script, `intent:`, `file:`, `data:` or an undeclared app. */
export function isOpenableUrl(url: string, appSchemes: readonly string[]): boolean {
  const scheme = schemeOf(url);
  return !!scheme && (PAGE_OPEN_SCHEMES.has(scheme) || appSchemes.includes(scheme));
}

function decodeOrNull(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
