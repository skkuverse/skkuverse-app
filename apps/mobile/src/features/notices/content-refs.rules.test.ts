/**
 * What the detail screen lifts out of a notice body today: images with their
 * size hints, links titled by their text or domain, emails and phone numbers.
 * The production fixture's body carries none of these, so the cases that need
 * them build their markdown inline.
 */
import { describe, expect, it } from 'vitest';
import detail from './__fixtures__/notice-detail.json';
import { extractContentRefs } from './content-refs.rules';

const EMPTY = { images: [], links: [], emails: [], phones: [] };

describe('extractContentRefs', () => {
  it('finds nothing in the production fixture body', () => {
    // Act
    const refs = extractContentRefs(detail.data.contentMarkdown);

    // Assert
    expect(refs).toEqual(EMPTY);
  });

  it('gives empty refs for a missing body', () => {
    // Assert
    expect(extractContentRefs(null)).toEqual(EMPTY);
    expect(extractContentRefs(undefined)).toEqual(EMPTY);
    expect(extractContentRefs('')).toEqual(EMPTY);
  });

  it('reads an image size hint from the alt text and strips it', () => {
    // Act
    const refs = extractContentRefs(
      '![{800x1200} 포스터](https://a.skku.edu/p.png) ![{w640}](https://a.skku.edu/w.png) ![{h300} h](https://a.skku.edu/h.png) ![plain](https://a.skku.edu/n.png)',
    );

    // Assert
    expect(refs.images).toEqual([
      { url: 'https://a.skku.edu/p.png', width: 800, height: 1200, alt: '포스터' },
      { url: 'https://a.skku.edu/w.png', width: 640, alt: '' },
      { url: 'https://a.skku.edu/h.png', height: 300, alt: 'h' },
      { url: 'https://a.skku.edu/n.png', alt: 'plain' },
    ]);
    expect(refs.links).toEqual([]);
  });

  it('titles a markdown link by its text and a bare URL by its domain', () => {
    // Act
    const refs = extractContentRefs(
      '[신청하기](https://forms.gle/abc) 자세한 내용: https://www.skku.edu/notice?id=1.',
    );

    // Assert
    expect(refs.links).toEqual([
      { url: 'https://forms.gle/abc', text: '신청하기', domain: 'forms.gle' },
      { url: 'https://www.skku.edu/notice?id=1', text: null, domain: 'skku.edu' },
    ]);
  });

  it('treats a bare image URL as an image, not a link', () => {
    // Act
    const refs = extractContentRefs('포스터 https://a.skku.edu/poster.jpg 참고');

    // Assert
    expect(refs.images).toEqual([{ url: 'https://a.skku.edu/poster.jpg', alt: '' }]);
    expect(refs.links).toEqual([]);
  });

  it('skips URLs the screen already shows, and duplicates', () => {
    // Act
    const refs = extractContentRefs(
      'https://a.skku.edu/file.zip https://forms.gle/x https://forms.gle/x',
      ['https://a.skku.edu/file.zip'],
    );

    // Assert
    expect(refs.links).toEqual([{ url: 'https://forms.gle/x', text: null, domain: 'forms.gle' }]);
  });

  it('collects emails from mailto links and plain text, lowercased and once each', () => {
    // Act
    const refs = extractContentRefs('[문의](mailto:AICOSS@skku.edu) 또는 aicoss@skku.edu, help@g.skku.edu');

    // Assert
    expect(refs.emails).toEqual(['aicoss@skku.edu', 'help@g.skku.edu']);
  });

  it('collects area-coded phone numbers whole and normalized, and nothing shorter', () => {
    // Act
    const refs = extractContentRefs('문의 031-299-4775, 02.760.1234, 070-5153-3113, 내선 299-4775');

    // Assert
    expect(refs.phones).toEqual(['031-299-4775', '02-760-1234', '070-5153-3113']);
  });

  it.each([
    ['a run of email characters', 'a'.repeat(100_000)],
    ['unclosed image openers', '!['.repeat(50_000)],
    ['image openers with unclosed targets', '![a]('.repeat(20_000)],
    ['link openers with unclosed targets', '[a]('.repeat(25_000)],
    ['a link ending in punctuation', `[a](http://${'.'.repeat(100_000)}x)`],
  ])('reads a 100,000-character body of %s in under a second', (_shape, body) => {
    // Act
    const started = performance.now();
    extractContentRefs(body);

    // Assert
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
