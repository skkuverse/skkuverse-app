export type MarkdownLinkAction =
  | { kind: 'open'; url: string }
  | { kind: 'copy'; value: string; contact: 'mailto' | 'tel' | 'other' };

/** WHY: only a web link leaves the app; a mail or phone link copies its address, and any other scheme is copied as text. */
export function markdownLinkAction(href: string): MarkdownLinkAction {
  if (href.startsWith('http://') || href.startsWith('https://')) return { kind: 'open', url: href };
  if (href.startsWith('mailto:')) return { kind: 'copy', value: href.slice(7), contact: 'mailto' };
  if (href.startsWith('tel:')) return { kind: 'copy', value: href.slice(4), contact: 'tel' };
  return { kind: 'copy', value: href, contact: 'other' };
}
