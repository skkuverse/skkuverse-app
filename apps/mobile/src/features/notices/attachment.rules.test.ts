/**
 * Attachment kinds, previews and the hotlink proxy URL, over the production
 * fixture's attachment and a few names of each kind.
 */
import { describe, expect, it } from 'vitest';
import detail from './__fixtures__/notice-detail.json';
import {
  buildAttachmentUrl,
  canPreview,
  canThumbnail,
  getAttachmentKind,
  getExtension,
  getExtensionLabel,
} from './attachment.rules';

const attachment = detail.data.attachments[0]!;

describe('the fixture attachment', () => {
  it('is an archive with an uppercase extension, read case-insensitively', () => {
    // Assert
    expect(getExtension(attachment.name)).toBe('.zip');
    expect(getAttachmentKind(attachment.name)).toBe('archive');
    expect(getExtensionLabel(attachment.name)).toBe('ZIP');
    expect(canPreview(attachment.name)).toBe(false);
    expect(canThumbnail(attachment.name)).toBe(false);
  });

  it('opens through the proxy with its notice page as the referer', () => {
    // Act
    const url = buildAttachmentUrl(attachment.url, detail.data.sourceUrl, 'download', attachment.name);

    // Assert
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      'https://files.skkuverse.com/notices/proxy/attachment',
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      url: attachment.url,
      referer: detail.data.sourceUrl,
      mode: 'download',
      name: attachment.name,
    });
  });

  it('leaves the name off an inline proxy URL that has none', () => {
    // Act
    const url = buildAttachmentUrl('https://x.skku.edu/a.pdf', 'https://x.skku.edu/n', 'inline');

    // Assert
    expect(url).toBe(
      'https://files.skkuverse.com/notices/proxy/attachment?url=https%3A%2F%2Fx.skku.edu%2Fa.pdf&referer=https%3A%2F%2Fx.skku.edu%2Fn&mode=inline',
    );
  });
});

describe('attachment kinds', () => {
  it('maps each extension family to its kind', () => {
    // Assert
    expect(['a.jpg', 'a.webp', 'a.bmp'].map(getAttachmentKind)).toEqual(['image', 'image', 'image']);
    expect(getAttachmentKind('a.pdf')).toBe('pdf');
    expect(['a.hwp', 'a.hwpx', 'a.doc', 'a.docx'].map(getAttachmentKind)).toEqual(['doc', 'doc', 'doc', 'doc']);
    expect(['a.xls', 'a.xlsx', 'a.csv'].map(getAttachmentKind)).toEqual(['sheet', 'sheet', 'sheet']);
    expect(['a.ppt', 'a.pptx'].map(getAttachmentKind)).toEqual(['slide', 'slide']);
    expect(['a.rar', 'a.7z'].map(getAttachmentKind)).toEqual(['archive', 'archive']);
    expect(getAttachmentKind('README')).toBe('other');
  });

  it('thumbnails only the image types the proxy serves, previews all but binary documents', () => {
    // Assert
    expect(['a.jpg', 'a.jpeg', 'a.png', 'a.gif'].every(canThumbnail)).toBe(true);
    expect(canThumbnail('a.webp')).toBe(false);
    expect(canPreview('a.pdf')).toBe(true);
    expect(canPreview('a.hwp')).toBe(false);
  });

  it('has no label or extension for a name without one', () => {
    // Assert
    expect(getExtension('README')).toBe('');
    expect(getExtensionLabel('README')).toBeNull();
  });
});
