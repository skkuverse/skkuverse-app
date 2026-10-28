/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/shared/miniapp-target.util.ts parses the same
 * `<miniAppId>[<root-relative path>]` grammar. An id, not a URL: one host can serve several mini apps.
 */
export interface MiniAppTarget {
  id: string;
  path?: string;
}

const TARGET_RE = /^([a-z0-9-]+)(\/.*)?$/;
// WHY: `//evil.com` and `/\evil.com` both parse as a new authority, so neither may start a path.
const ROOT_RELATIVE_PATH_RE = /^\/(?![/\\])[^\s]*$/;
const WHITESPACE_RE = /\s/;

export function parseMiniAppTarget(value: unknown): MiniAppTarget | null {
  // WHY: refused before matching: `$` without the `m` flag still matches before a trailing newline.
  if (typeof value !== 'string' || value === '' || WHITESPACE_RE.test(value)) {
    return null;
  }
  const match = TARGET_RE.exec(value);
  if (!match) return null;
  const [, id, path] = match;
  if (!id) return null;
  if (path === undefined) return { id };
  if (!ROOT_RELATIVE_PATH_RE.test(path)) return null;
  return { id, path };
}

/**
 * WHY: fails closed on origin: a deep link can carry any path, and the shell badges whatever it
 * loads as verified. Only the origin is checked; which pages exist is the app's.
 */
export function resolveMiniAppUrl(startUrl: string, path: string | undefined): string {
  if (!path) return startUrl;
  try {
    const base = new URL(startUrl);
    const resolved = new URL(path, base);
    return resolved.origin === base.origin ? resolved.toString() : startUrl;
  } catch {
    return startUrl;
  }
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/infra/origins.ts maps each first-party origin to one
 * mini app, so a URL there names that app. A path the grammar refuses (`//evil.com`) opens the start page.
 */
export function miniAppTargetForUrl(
  url: string,
  origins: Readonly<Record<string, string>>,
): MiniAppTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  // WHY: an origin is `scheme://host[:port]`, so it can never name a prototype key.
  const id = origins[parsed.origin];
  if (!id) return null;
  return parseMiniAppTarget(`${id}${parsed.pathname}${parsed.search}${parsed.hash}`) ?? { id };
}
