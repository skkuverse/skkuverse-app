/**
 * The detail screen's original section: each link role opens a url, its own
 * or one of the notice's links on the same domain, and each attachment role
 * names a file the notice carries.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import detailScreen from './__fixtures__/notice-detail-screen.json';
import { toActionUrls, toOriginalAttachments, toOriginalLinks } from './notice-screen.rules';
import type { NoticeScreenLine } from './notice-facts.types';
import { noticeDetailSchema } from './notices.schema';

describe('toOriginalLinks', () => {
  it('opens a role at its own url before any by domain', () => {
    // Act
    const links = toOriginalLinks([{ role: '신청', domain: 'forms.gle', url: 'https://forms.gle/own' }], ['https://forms.gle/body']);

    // Assert
    expect(links).toStrictEqual({ linked: [{ url: 'https://forms.gle/own', text: '신청', domain: 'forms.gle' }], unlinked: [] });
  });

  it('finds a url by domain, www or not, and uses each url once', () => {
    // Act
    const links = toOriginalLinks(
      [
        { role: '신청', domain: 'forms.gle', url: null },
        { role: '설문', domain: 'forms.gle', url: null },
        { role: '안내', domain: 'www.skku.edu', url: null },
      ],
      ['https://forms.gle/a', 'https://www.skku.edu/notice', 'https://forms.gle/b'],
    );

    // Assert
    expect(links.linked).toStrictEqual([
      { url: 'https://forms.gle/a', text: '신청', domain: 'forms.gle' },
      { url: 'https://forms.gle/b', text: '설문', domain: 'forms.gle' },
      { url: 'https://www.skku.edu/notice', text: '안내', domain: 'www.skku.edu' },
    ]);
    expect(links.unlinked).toStrictEqual([]);
  });

  it('leaves a role with no url on its domain unlinked', () => {
    // Act
    const links = toOriginalLinks(
      [
        { role: '신청', domain: 'forms.gle', url: null },
        { role: '홈페이지', domain: 'histarter.wixsite.com', url: null },
      ],
      ['https://forms.gle/a'],
    );

    // Assert
    expect(links.unlinked).toStrictEqual([{ role: '홈페이지', domain: 'histarter.wixsite.com' }]);
  });
});

describe('toActionUrls', () => {
  it('lists the link of every line, folded ones included, and of the bar', () => {
    // Arrange
    const screen = parseOrThrow(noticeDetailSchema, detailScreen.data, 'notices.detail').screen!;
    const folded: NoticeScreenLine = {
      text: 'f',
      sub: null,
      source: 'body',
      quote: null,
      actions: [
        { kind: 'link', url: 'https://f.com' },
        { kind: 'call', number: '02-760-1234' },
      ],
    };

    // Act
    const urls = toActionUrls({ ...screen, blocks: [...screen.blocks, { ...screen.blocks[0]!, foldedLines: [folded] }] });

    // Assert
    expect(urls).toStrictEqual(['https://forms.gle/WWPGKVxiUoXXLBBe6', 'https://f.com', 'https://forms.gle/WWPGKVxiUoXXLBBe6']);
  });
});

describe('toOriginalAttachments', () => {
  it('names a file by its exact name, and keeps a role with no such file apart', () => {
    // Arrange
    const files = [
      { name: '신청서.hwp', url: 'https://skku.edu/a' },
      { name: '안내문.pdf', url: 'https://skku.edu/b' },
    ];

    // Act
    const attachments = toOriginalAttachments(
      [
        { role: '신청서', name: '신청서.hwp' },
        { role: '포스터', name: '포스터.png' },
      ],
      files,
    );

    // Assert
    expect([...attachments.roleByName]).toStrictEqual([['신청서.hwp', '신청서']]);
    expect(attachments.unmatched).toStrictEqual([{ role: '포스터', name: '포스터.png' }]);
  });
});
