import { toDomain, type ExtractedLink } from './content-refs.rules';
import type { NoticeScreen, NoticeScreenOriginalAttachment, NoticeScreenOriginalLink } from './notice-facts.types';
import type { NoticeAttachment } from './notices.types';

export interface NoticeOriginalLinks {
  linked: ExtractedLink[];
  unlinked: Omit<NoticeScreenOriginalLink, 'url'>[];
}

/**
 * WHY: until the server sends each link's url, a role finds its url among the notice's own links by domain,
 * each url used once; one with no match shows its role and domain, unlinked.
 */
export function toOriginalLinks(
  links: readonly NoticeScreenOriginalLink[],
  candidateUrls: readonly string[],
): NoticeOriginalLinks {
  const used = new Set<string>();
  const linked: ExtractedLink[] = [];
  const unlinked: NoticeOriginalLinks['unlinked'] = [];
  for (const { role, domain, url } of links) {
    const bareDomain = domain.replace(/^www\./, '');
    const match = url ?? candidateUrls.find((candidate) => !used.has(candidate) && toDomain(candidate) === bareDomain);
    if (match === undefined) {
      unlinked.push({ role, domain });
      continue;
    }
    used.add(match);
    linked.push({ url: match, text: role, domain });
  }
  return { linked, unlinked };
}

export interface NoticeOriginalAttachments {
  roleByName: ReadonlyMap<string, string>;
  unmatched: NoticeScreenOriginalAttachment[];
}

export function toOriginalAttachments(
  roles: readonly NoticeScreenOriginalAttachment[],
  attachments: readonly NoticeAttachment[],
): NoticeOriginalAttachments {
  const names = new Set(attachments.map((attachment) => attachment.name));
  return {
    roleByName: new Map(roles.filter(({ name }) => names.has(name)).map(({ role, name }) => [name, role])),
    unmatched: roles.filter(({ name }) => !names.has(name)),
  };
}

export function toActionUrls(screen: NoticeScreen): string[] {
  const lineActions = screen.blocks.flatMap((block) => [...block.lines, ...block.foldedLines]).flatMap((line) => line.actions);
  const actions = screen.action ? [...lineActions, screen.action.action] : lineActions;
  return actions.flatMap((action) => (action.kind === 'link' ? [action.url] : []));
}

export type NoticeQuoteFocus =
  | { kind: 'none' }
  | { kind: 'found'; before: string; line: string; after: string }
  | { kind: 'pinned'; quote: string };

const FENCE = /^\s{0,3}(```|~~~)/;
const TABLE_ROW = /^\s*\|/;
const CONTINUATION = /^(?: {2,}|\t)(?![-*+] |\d+[.)] )\S/;
const SETEXT_UNDERLINE = /^\s{0,3}(?:=+|-+)\s*$/;

/** WHY: the quote is the source sentence as the server read it, so emphasis, escapes and full-width forms are not part of it. */
function toComparable(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\\(.)/g, '$1')
    .replace(/\*\*|__|~~/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * EVIDENCE: a crawled body is a few paragraphs of hard-broken lines (skku-main 140957 holds 50 hard breaks in 5 paragraphs), so a
 * paragraph would light up dozens of lines; the focus is one source line, and a line that cannot stand alone is skipped.
 */
export function toQuoteFocus(markdown: string | null, quote: string | null): NoticeQuoteFocus {
  if (quote === null) return { kind: 'none' };
  const target = toComparable(quote);
  if (target === '') return { kind: 'none' };
  if (markdown === null) return { kind: 'pinned', quote };
  const lines = markdown.split('\n');
  let isInFence = false;
  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) {
      isInFence = !isInFence;
      continue;
    }
    const next = lines[index + 1] ?? '';
    if (isInFence || TABLE_ROW.test(line) || CONTINUATION.test(next) || SETEXT_UNDERLINE.test(next)) continue;
    if (toComparable(line).includes(target)) {
      return { kind: 'found', before: lines.slice(0, index).join('\n'), line, after: lines.slice(index + 1).join('\n') };
    }
  }
  return { kind: 'pinned', quote };
}
