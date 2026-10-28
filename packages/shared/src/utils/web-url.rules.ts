/** WHY: the path is dropped: the game host loads the registry's `entryUrl`, never a page a link names. */
export function gameIdForUrl(url: string, origins: Readonly<Record<string, string>>): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  return Object.hasOwn(origins, parsed.origin) ? (origins[parsed.origin] ?? null) : null;
}

/** WHY: the parsed `href` is what loads, so the host checked is the host the WebView gets. */
export function toBrowserUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname === '') return null;
  if (parsed.username !== '' || parsed.password !== '') return null;
  return parsed.href;
}
