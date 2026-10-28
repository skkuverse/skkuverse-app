/** WHY: a site's own icon is usually 16px, which blurs on a retina screen, so a 128px one is asked of Google. */
export function faviconUrl(pageUrl: string, size = 128): string | null {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const params = `client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(u.origin)}&size=${size}`;
    return `https://t1.gstatic.com/faviconV2?${params}`;
  } catch {
    return null;
  }
}
