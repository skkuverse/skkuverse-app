import { useQueries } from '@tanstack/react-query';
import { readMetaTags, readTitle } from '../link-preview.rules';

/**
 * WHY: fetched on the device because the server has no unfurl endpoint; if one ships, only `queryFn`
 * changes. Failure is normal (bot blocks, JS-only pages, no OG tags), so it yields null and never retries.
 */

export interface LinkPreview {
  title: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

/** WHY: OG tags live in `<head>`, so nothing past this offset is read. */
const SCAN_LIMIT = 120_000;
const FETCH_TIMEOUT_MS = 6_000;

/**
 * EVIDENCE: some old Korean sites (www.aik.or.kr) declare utf-8 but send EUC-KR, and Hermes has no
 * `TextDecoder('euc-kr')`, so garbled text is dropped for the domain fallback. Image URLs are ASCII and kept.
 */
function isMojibake(s: string): boolean {
  return s.includes('�');
}

function absolutize(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

async function fetchPreview(url: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // WHY: some sites block the default React Native User-Agent as a bot.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;

    const html = (await res.text()).slice(0, SCAN_LIMIT);
    // WHY: external HTML, so it is read only by a linear scan (link-preview.rules.ts).
    const meta = readMetaTags(html);
    const rawTitle = meta.get('og:title') ?? meta.get('twitter:title') ?? readTitle(html);
    const title = rawTitle && !isMojibake(rawTitle) ? rawTitle : null;

    const imageUrl = absolutize(
      meta.get('og:image') ?? meta.get('twitter:image') ?? null,
      // WHY: relative paths resolve against the final URL, after any redirect.
      res.url || url,
    );

    if (!title && !imageUrl) return null;

    const rawSite = meta.get('og:site_name');
    return {
      title,
      imageUrl,
      siteName: rawSite && !isMojibake(rawSite) ? rawSite : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function useLinkPreviews(urls: readonly string[]) {
  return useQueries({
    queries: urls.map((url) => ({
      queryKey: ['link-preview', url] as const,
      queryFn: () => fetchPreview(url),
      // WHY: a linked page rarely changes, and scraping an outside site on every list and detail visit is rude.
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    })),
  });
}
