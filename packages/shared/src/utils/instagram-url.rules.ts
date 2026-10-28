/**
 * QUIRK(instagram): its universal and app links claim every https path, so `Linking.openURL` opens the
 * app or the browser; `instagram://p/<code>` opens the home feed instead and does not reject, and a
 * page in an in-app web view never reaches the app.
 */

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);

function instagramUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

export function isInstagramUrl(value: string): boolean {
  return instagramUrl(value) !== null;
}

/**
 * QUIRK(ios): iOS asks about iframes too (`isTopFrame: false`), and an embed must keep loading in
 * place; Android reports top frames only and leaves `isTopFrame` unset.
 */
export function handsOffToOs(request: { url: string; isTopFrame?: boolean }): boolean {
  return request.isTopFrame !== false && isInstagramUrl(request.url);
}

const RESERVED_PROFILE_PATHS = new Set([
  'accounts',
  'direct',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
]);

function isProfile(value: string): boolean {
  const url = instagramUrl(value);
  if (!url) return false;
  const [username, extra] = url.pathname.split('/').filter(Boolean);
  return !!username && !extra && !RESERVED_PROFILE_PATHS.has(username.toLowerCase());
}

function isMedia(value: string): boolean {
  const url = instagramUrl(value);
  if (!url) return false;
  const [kind, shortcode, extra] = url.pathname.split('/').filter(Boolean);
  return !!shortcode && !extra && ['p', 'reel', 'reels'].includes(kind?.toLowerCase() ?? '');
}

/** WHY: checked here too, so a malformed authored value never leaves the app. */
export function instagramDestination(profileUrl: string, postUrl: string | null): string | null {
  if (postUrl && isMedia(postUrl)) return postUrl;
  return isProfile(profileUrl) ? profileUrl : null;
}
