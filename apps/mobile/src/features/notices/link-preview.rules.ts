/**
 * EVIDENCE: the HTML is untrusted and parsed on the JS thread, where a timeout cannot interrupt it; an
 * unanchored pattern with two `[^>]+` runs took minutes on unterminated `<meta` tags, so every scan moves forward.
 */

/** WHY: a tag longer than this is no real meta tag, so it is skipped unread. */
const MAX_TAG_LENGTH = 2_048;

const META_OPEN = '<meta';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const isNameChar = (c: string): boolean => /[a-z0-9:_-]/i.test(c);
const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

/** WHY: a hand scan, since a `name = "value"` pattern re-reads a long name at each position when no `=` follows. */
function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  let i = 0;
  while (i < tag.length) {
    if (!isNameChar(tag[i]!)) {
      i++;
      continue;
    }
    const nameStart = i;
    while (i < tag.length && isNameChar(tag[i]!)) i++;
    const name = tag.slice(nameStart, i).toLowerCase();
    while (i < tag.length && isSpace(tag[i]!)) i++;
    if (tag[i] !== '=') continue;
    i++;
    while (i < tag.length && isSpace(tag[i]!)) i++;
    const quote = tag[i];
    if (quote !== '"' && quote !== "'") continue;
    const valueEnd = tag.indexOf(quote, i + 1);
    if (valueEnd === -1) break;
    attributes.set(name, tag.slice(i + 1, valueEnd));
    i = valueEnd + 1;
  }
  return attributes;
}

/** WHY: the first non-empty content wins. */
export function readMetaTags(html: string): Map<string, string> {
  const lower = html.toLowerCase();
  const meta = new Map<string, string>();
  // WHY: the next `>` is found once and reused while later opens still sit before it, so no stretch is scanned twice.
  let close = -1;
  let open = lower.indexOf(META_OPEN);
  while (open !== -1) {
    if (close < open) close = lower.indexOf('>', open);
    if (close === -1) break;
    if (close - open > MAX_TAG_LENGTH) {
      open = lower.indexOf(META_OPEN, open + META_OPEN.length);
      continue;
    }
    const attributes = readAttributes(html.slice(open + META_OPEN.length, close));
    const key = (attributes.get('property') ?? attributes.get('name'))?.toLowerCase();
    const content = decodeEntities(attributes.get('content') ?? '');
    if (key && content && !meta.has(key)) meta.set(key, content);
    open = lower.indexOf(META_OPEN, close + 1);
  }
  return meta;
}

export function readTitle(html: string): string | null {
  const lower = html.toLowerCase();
  const open = lower.indexOf('<title');
  if (open === -1) return null;
  const start = lower.indexOf('>', open);
  if (start === -1) return null;
  const end = lower.indexOf('</title>', start + 1);
  if (end === -1) return null;
  return decodeEntities(html.slice(start + 1, end));
}
