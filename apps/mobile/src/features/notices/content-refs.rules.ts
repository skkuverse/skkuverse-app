/**
 * EVIDENCE: in 23 notices sampled on 2026-08-01, 13 carried a bare URL and 3 a markdown link, so a bare
 * URL is first-class and a link with no text shows its domain.
 */

export interface ExtractedImage {
  url: string;
  /** WHY: the `{WxH}` hint the crawler puts in the alt, read to reserve the image's ratio. */
  width?: number;
  height?: number;
  alt: string;
}

export interface ExtractedLink {
  url: string;
  text: string | null;
  domain: string;
}

export interface ContentRefs {
  images: ExtractedImage[];
  links: ExtractedLink[];
  emails: string[];
  phones: string[];
}

const EMPTY: ContentRefs = { images: [], links: [], emails: [], phones: [] };

/**
 * WHY: images go first and are masked, or their URLs come back as links. Neither the text nor the target
 * crosses a `[`, so a failed match never rescans the next opener and a crawled body scans in linear time.
 */
const IMAGE_RE = /!\[([^[\]]*)\]\(([^)\s[]+)\)/g;
const MD_LINK_RE = /(?<!!)\[([^[\]]*)\]\(([^)\s[]+)\)/g;
/** WHY: run only after markdown links are masked. */
const BARE_URL_RE = /(?<![(\w])(https?:\/\/[^\s<>()[\]"']+)/g;
/** WHY: a match starts only where a word begins, or a long run with no `@` is rescanned from every character. */
const EMAIL_RE = /(?<![\w.+-])[\w.+-]+@[\w-]+\.[\w.-]*\w/g;

/**
 * EVIDENCE: a branch for extensions (`\d{3,4}-\d{4}`) cut all 7 sampled numbers to their tail
 * (`031-299-4775` became `299-4775`), and every sample opened with an area code, so a number starts with 0.
 */
const PHONE_RE = /(?<![\d-])(0\d{1,2})[-.]\s?(\d{3,4})[-.]\s?(\d{4})(?![\d-])/g;

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i;

/**
 * CONTRACT(skkuverse-crawler): skkuverse-crawler/py/src/skkuverse_crawler/shared/html_to_markdown.py prefixes
 * an image's alt with `{WxH}`, `{wN}` or `{hN}`; NoticeMarkdownView's parseDimHint reads it too, so change both.
 */
function parseDimHint(alt: string): { width?: number; height?: number; cleanAlt: string } {
  const full = alt.match(/^\{(\d+)x(\d+)\}\s?(.*)/s);
  if (full) return { width: +full[1], height: +full[2], cleanAlt: full[3] };
  const wOnly = alt.match(/^\{w(\d+)\}\s?(.*)/s);
  if (wOnly) return { width: +wOnly[1], cleanAlt: wOnly[2] };
  const hOnly = alt.match(/^\{h(\d+)\}\s?(.*)/s);
  if (hOnly) return { height: +hOnly[1], cleanAlt: hOnly[2] };
  return { cleanAlt: alt };
}

const TRAILING_PUNCTUATION = new Set('.,;:!?)]}>\'"');

/** WHY: a loop, since an end-anchored regex retries from every character of a long run of punctuation. */
function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(url[end - 1])) end--;
  return url.slice(0, end);
}

function toDomain(url: string): string {
  // WHY: `new URL()` throws on a malformed URL, and extracted text is untrusted.
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizePhone(area: string, mid: string, last: string): string {
  return `${area}-${mid}-${last}`;
}

export function extractContentRefs(
  markdown: string | null | undefined,
  excludeUrls: readonly string[] = [],
): ContentRefs {
  if (!markdown) return EMPTY;

  const excluded = new Set(excludeUrls);

  // WHY: images are removed from the text, or their URLs match again as links below.
  const images: ExtractedImage[] = [];
  const seenImages = new Set<string>();
  let masked = markdown.replace(IMAGE_RE, (_m, alt: string, url: string) => {
    if (!seenImages.has(url) && !excluded.has(url)) {
      seenImages.add(url);
      const { width, height, cleanAlt } = parseDimHint(alt ?? '');
      images.push({ url, width, height, alt: cleanAlt });
    }
    return ' ';
  });

  const links: ExtractedLink[] = [];
  const emails: string[] = [];
  const seenLinks = new Set<string>();
  const seenEmails = new Set<string>();

  const pushLink = (rawUrl: string, text: string | null) => {
    const url = trimTrailingPunctuation(rawUrl);
    if (seenLinks.has(url) || excluded.has(url)) return;
    // WHY: a bare poster URL listed as a link reads as an application link.
    if (IMAGE_EXT_RE.test(url)) {
      if (!seenImages.has(url)) {
        seenImages.add(url);
        images.push({ url, alt: '' });
      }
      return;
    }
    seenLinks.add(url);
    links.push({ url, text: text?.trim() || null, domain: toDomain(url) });
  };

  const pushEmail = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!seenEmails.has(value)) {
      seenEmails.add(value);
      emails.push(value);
    }
  };

  masked = masked.replace(MD_LINK_RE, (_m, text: string, url: string) => {
    if (url.startsWith('mailto:')) pushEmail(url.slice(7));
    else if (/^https?:\/\//i.test(url)) pushLink(url, text);
    return ' ';
  });

  masked = masked.replace(BARE_URL_RE, (m: string) => {
    pushLink(m, null);
    return ' ';
  });

  for (const m of masked.matchAll(EMAIL_RE)) pushEmail(m[0]);

  const phones: string[] = [];
  const seenPhones = new Set<string>();
  for (const m of markdown.matchAll(PHONE_RE)) {
    const value = normalizePhone(m[1], m[2], m[3]);
    if (!seenPhones.has(value)) {
      seenPhones.add(value);
      phones.push(value);
    }
  }

  return { images, links, emails, phones };
}
