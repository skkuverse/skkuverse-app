/**
 * QUIRK(expo): native-intent's `path` may be a full URL or a bare pathname, so both are handled.
 * SEE: docs/reference/deep-link.md ("The authority fold: `skkuverse:` is a non-special scheme")
 */

const APP_SCHEME = 'skkuverse:';

/** WHY: its authority is an artifact of needing a base at all; never fold it. */
const RELATIVE_BASE = 'skkuverse://app';

export interface IncomingLink {
  pathname: string;
  params: URLSearchParams;
}

export function parseIncomingLink(rawPath: string): IncomingLink {
  try {
    const url = new URL(rawPath);
    const path =
      url.protocol === APP_SCHEME && url.hostname
        ? `/${url.hostname.toLowerCase()}${url.pathname}`
        : url.pathname;
    return finish(path, url.searchParams);
  } catch {
    // WHY: a bare pathname throws here and takes the relative form below.
  }

  try {
    const url = new URL(rawPath, RELATIVE_BASE);
    return finish(url.pathname, url.searchParams);
  } catch {
    // WHY: with `URL` broken, string surgery beats dropping the link.
    return finish(stripQueryAndFragment(rawPath), new URLSearchParams());
  }
}

export function normalizeIncomingPath(rawPath: string): string {
  return parseIncomingLink(rawPath).pathname;
}

function finish(rawPathname: string, params: URLSearchParams): IncomingLink {
  let pathname = rawPathname;
  if (pathname === '') pathname = '/';
  else if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.startsWith('/p/')) pathname = pathname.substring(2);
  return { pathname, params };
}

function stripQueryAndFragment(raw: string): string {
  let out = raw;
  const q = out.indexOf('?');
  if (q !== -1) out = out.substring(0, q);
  const hash = out.indexOf('#');
  if (hash !== -1) out = out.substring(0, hash);
  return out;
}
