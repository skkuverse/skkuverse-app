import { describe, expect, it } from 'vitest';
import { markdownLinkAction } from './markdown-link.rules';

describe('markdownLinkAction', () => {
  it('opens a web link in the browser', () => {
    // Assert
    expect(markdownLinkAction('https://www.skku.edu/notice')).toEqual({
      kind: 'open',
      url: 'https://www.skku.edu/notice',
    });
    expect(markdownLinkAction('http://example.com')).toEqual({ kind: 'open', url: 'http://example.com' });
  });

  it('copies a mail or phone address without its scheme', () => {
    // Assert
    expect(markdownLinkAction('mailto:help@example.com')).toEqual({
      kind: 'copy',
      value: 'help@example.com',
      contact: 'mailto',
    });
    expect(markdownLinkAction('tel:031-299-4775')).toEqual({
      kind: 'copy',
      value: '031-299-4775',
      contact: 'tel',
    });
  });

  it.each(['sms:01012345678', 'itms-services://?action=download-manifest', 'javascript:alert(1)', 'intent://x'])(
    'never opens %s',
    (href) => {
      // Assert
      expect(markdownLinkAction(href)).toEqual({ kind: 'copy', value: href, contact: 'other' });
    },
  );
});
