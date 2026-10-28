/**
 * The detail screen's original section: each link role opens a url, its own
 * or one of the notice's links on the same domain, and each attachment role
 * names a file the notice carries. And where a tapped line's quote sits in the
 * body: the source line that holds it, or the quote pinned above the body.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import detailScreen from './__fixtures__/notice-detail-screen.json';
import { toActionUrls, toOriginalAttachments, toOriginalLinks, toQuoteFocus } from './notice-screen.rules';
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
  const files = [
    { name: '안내문.pdf', url: 'https://skku.edu/b' },
    { name: '신청서.hwp', url: 'https://skku.edu/a' },
    { name: '기타.zip', url: 'https://skku.edu/c' },
  ];

  it('opens a role at its own url, listing role files first and every other file after', () => {
    // Act
    const attachments = toOriginalAttachments([{ role: '신청서', name: '신청서.hwp', url: 'https://skku.edu/a' }], files);

    // Assert
    expect(attachments.files).toStrictEqual([
      { name: '신청서.hwp', url: 'https://skku.edu/a' },
      { name: '안내문.pdf', url: 'https://skku.edu/b' },
      { name: '기타.zip', url: 'https://skku.edu/c' },
    ]);
    expect([...attachments.roleByUrl]).toStrictEqual([['https://skku.edu/a', '신청서']]);
    expect(attachments.unmatched).toStrictEqual([]);
  });

  it('opens a role the server sent no url for by its exact file name', () => {
    // Act
    const attachments = toOriginalAttachments([{ role: '안내문', name: '안내문.pdf', url: null }], files);

    // Assert
    expect([...attachments.roleByUrl]).toStrictEqual([['https://skku.edu/b', '안내문']]);
    expect(attachments.files.map((file) => file.name)).toStrictEqual(['안내문.pdf', '신청서.hwp', '기타.zip']);
  });

  it('keeps a role with no url and no such file apart', () => {
    // Act
    const attachments = toOriginalAttachments([{ role: '포스터', name: '포스터.png', url: null }], files);

    // Assert
    expect(attachments.unmatched).toStrictEqual([{ role: '포스터', name: '포스터.png' }]);
    expect(attachments.files).toStrictEqual(files);
  });
});

describe('toQuoteFocus', () => {
  const body = [
    '1\\. 모집 분야 및 상세 업무  ',
    '• 모집 인원: 과목당 1～2명  ',
    '• 유의 사항:  ',
    ' - **문화행사** 필수 참석  ',
    ' - WISE 수업 수강 불가  ',
    '• 시급: 2026년 10,320원',
  ].join('\n');

  it('splits the body around the line that holds the quote', () => {
    // Act
    const focus = toQuoteFocus(body, 'WISE 수업 수강 불가');

    // Assert
    expect(focus).toStrictEqual({
      kind: 'found',
      before: body.split('\n').slice(0, 4).join('\n'),
      line: ' - WISE 수업 수강 불가  ',
      after: '• 시급: 2026년 10,320원',
    });
  });

  it.each([
    ['a full-width tilde against a plain one', '과목당 1~2명', '• 모집 인원: 과목당 1～2명  '],
    ['an escaped period', '1. 모집 분야', '1\\. 모집 분야 및 상세 업무  '],
    ['bold markers', '문화행사 필수 참석', ' - **문화행사** 필수 참석  '],
    ['extra spaces in the quote', '시급:   2026년  10,320원', '• 시급: 2026년 10,320원'],
  ])('finds a quote across %s', (_name, quote, line) => {
    // Act
    const focus = toQuoteFocus(body, quote);

    // Assert
    expect(focus.kind === 'found' ? focus.line : focus).toBe(line);
  });

  it('finds the live quote whose body has a full-width tilde (U+FF5E) where the quote has an ASCII one', () => {
    // Arrange
    const live = '• 근무 기간  \n• TA: 2026. 12. 21.(월)\uFF5E2027. 1. 8.(금)  \n• OA: 2026. 12. 17.(목)';

    // Act
    const focus = toQuoteFocus(live, '2026. 12. 21.(월)~2027. 1. 8.(금)');

    // Assert
    expect(focus).toStrictEqual({
      kind: 'found',
      before: '• 근무 기간  ',
      line: '• TA: 2026. 12. 21.(월)\uFF5E2027. 1. 8.(금)  ',
      after: '• OA: 2026. 12. 17.(목)',
    });
  });

  it('takes the first line that holds the quote', () => {
    // Act
    const focus = toQuoteFocus('수료증 발급\n교환학생 가산점\n수료증 발급, 시급', '수료증 발급');

    // Assert
    expect(focus).toStrictEqual({ kind: 'found', before: '', line: '수료증 발급', after: '교환학생 가산점\n수료증 발급, 시급' });
  });

  it.each([
    ['in a table row', '| 기간 | 11/17~11/20 |\n| --- | --- |'],
    ['inside a code fence', '```\n접수 기간 11/17~11/20\n```'],
    ['on a list item whose next line continues it', '- 접수 기간 11/17~11/20\n  온라인으로만 받아요'],
    ['on a heading underlined on the next line', '접수 기간 11/17~11/20\n==='],
    ['nowhere in the body', '모집 안내'],
  ])('pins a quote found only %s above the body', (_name, markdown) => {
    // Act
    const focus = toQuoteFocus(markdown, '접수 기간 11/17~11/20');

    // Assert
    expect(focus).toStrictEqual({ kind: 'pinned', quote: '접수 기간 11/17~11/20' });
  });

  it('pins the quote of a notice with no body', () => {
    // Act & Assert
    expect(toQuoteFocus(null, '수료증 발급')).toStrictEqual({ kind: 'pinned', quote: '수료증 발급' });
  });

  it.each([null, '', '  ', '**'])('focuses nothing for the quote %j', (quote) => {
    // Act & Assert
    expect(toQuoteFocus(body, quote)).toStrictEqual({ kind: 'none' });
  });
});
