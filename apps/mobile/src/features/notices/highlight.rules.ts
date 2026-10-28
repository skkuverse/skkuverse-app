/**
 * WHY: every occurrence keeps the text's own casing (`m[0]`, not the query), and the query is
 * escaped, so "." stays literal and "[" never throws.
 */

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(REGEX_METACHARS, '\\$&');
}

export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  if (text.length === 0) return [];
  if (query.length === 0) return [{ text, matched: false }];

  const re = new RegExp(escapeRegex(query), 'gi');
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return [{ text, matched: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), matched: false });
    }
    segments.push({ text: m[0], matched: true });
    cursor = start + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}
