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
