import { commentLines, commentsOf } from './extract.mjs';

/** The `docs/...md` paths a comment cites, anchors dropped. */
export function citedDocs(text) {
  return [...text.matchAll(/(?:^|[^\w/.-])(docs\/[\w./-]+\.md)/g)].map((m) => m[1]);
}

const SECTION_CITE =
  /(?:^|[^\w/.-])(docs\/[\w./-]+\.md)(?:#([\w-]+)|\s?\(\s*"([^"]+)"\s*\)|\s?\(\s*([^")]+?)\s*\)|,\s*"([^"]+)"|\s?§\s?(\d+(?:\.\d+)*))/g;

/**
 * The doc sections a text cites, as `{ doc, section, isAnchor }`: `docs/x.md (Section)`,
 * `docs/x.md ("Section")`, `docs/x.md, "Section"`, `docs/x.md §2` or `docs/x.md#anchor`.
 */
export function citedSections(text) {
  return [...text.matchAll(SECTION_CITE)].map((m) => ({
    doc: m[1],
    section: (m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6]).trim(),
    isAnchor: m[2] !== undefined,
  }));
}

/** A markdown file's heading texts, fenced code skipped. */
export function headingsOf(markdown) {
  const headings = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    const m = fenced ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) headings.push(m[1]);
  }
  return headings;
}

const NUMBERED_ID = /^[A-Za-z]?\d+(?:\.\d+)*$/;

const slugOf = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

/** Whether the headings hold the section: its exact text, a heading a numbered id opens, or an anchor's slug. */
export function hasSection(headings, { section, isAnchor }) {
  if (isAnchor) return headings.some((h) => slugOf(h) === section);
  const wanted = section.toLowerCase();
  const opensWithId = (h) =>
    NUMBERED_ID.test(section) && new RegExp(`^${section.replace(/\./g, '\\.')}(?:\\.|\\s)(?!\\d)`, 'i').test(h);
  return headings.some((h) => h.trim().toLowerCase() === wanted || opensWithId(h.trim()));
}

/** Every `docs/...md` a comment cites that does not exist, and every cited section its doc lacks. */
export function docPathViolations(file, source, { exists, readDoc }) {
  return commentsOf(file, source).flatMap((comment) => {
    const text = commentLines(comment).join(' ');
    const missing = [...new Set(citedDocs(text))]
      .filter((doc) => !exists(doc))
      .map((doc) => ({ line: comment.line, message: `missing ${doc}` }));
    const sections = citedSections(text).flatMap((cite) => {
      const markdown = exists(cite.doc) ? readDoc(cite.doc) : null;
      if (markdown === null || hasSection(headingsOf(markdown), cite)) return [];
      return [{ line: comment.line, message: `${cite.doc} has no section "${cite.section}"` }];
    });
    return [...sections, ...missing];
  });
}
