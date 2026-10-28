import { beforeEach, describe, it, expect } from 'vitest';
import { parseOrThrow, setDropReporter, type ApiEnvelope } from '@skkuverse/shared';
import { campusSectionsSchema } from './campus-sheet.schema';
import noBanner from './__fixtures__/campus-sheet.no-banner-ko.json';

// The hand parser's call shape, over the schema that replaced it (migrate-map-data 4.4).
const parseCampusResponse = (envelope: ApiEnvelope<unknown>) =>
  parseOrThrow(campusSectionsSchema, envelope.data, 'campus.sections');

/**
 * The campus feed's banner carousel reuses the home carousel's parser; these
 * cases pin what the campus side adds on top: images only, and a malformed
 * section degrading to `unknown` rather than taking the feed down.
 */

const image = {
  type: 'image',
  id: 'eskara-2026-banner-01',
  imageUrl: 'https://media.skkuverse.com/campus/banners/eskara-2026-01-00000000.webp',
  alt: '청랑 현수막',
};

const grid = {
  type: 'button_grid',
  id: 'campus_buttons',
  columns: 4,
  items: [{ id: 'inquiry', title: '문의하기', emoji: '💬', actionType: 'external', actionValue: 'https://x' }],
};

function feed(...sections: unknown[]) {
  return parseCampusResponse({ meta: { lang: 'ko' }, data: { minAppVersion: '2.0.0', sections } } as never);
}

describe('parseCampusResponse — banner_carousel', () => {
  it('parses the server payload ahead of the tiles', () => {
    const carousel = { type: 'banner_carousel', id: 'campus_banners', aspectRatio: 6, autoRotateSec: 4, items: [image] };
    const { sections } = feed(carousel, grid);
    expect(sections.map((s) => s.type)).toEqual(['banner_carousel', 'button_grid']);
    expect(sections[0]).toEqual({
      type: 'banner_carousel',
      id: 'campus_banners',
      aspectRatio: 6,
      autoRotateSec: 4,
      items: [{ type: 'image', id: image.id, imageUrl: image.imageUrl, alt: image.alt }],
    });
  });

  it('drops a default item, which only the home screen can draw', () => {
    const carousel = { type: 'banner_carousel', id: 'c', aspectRatio: 6, autoRotateSec: 4, items: [{ type: 'default' }, image] };
    const [section] = feed(carousel).sections;
    expect(section).toMatchObject({ items: [{ type: 'image', id: image.id }] });
  });

  it('keeps a non-https image out of the rotation', () => {
    const carousel = {
      type: 'banner_carousel',
      id: 'c',
      aspectRatio: 6,
      autoRotateSec: 4,
      items: [{ ...image, imageUrl: 'http://media.skkuverse.com/a.webp' }],
    };
    expect(feed(carousel).sections[0]).toMatchObject({ items: [] });
  });

  it('degrades a carousel with no id to unknown, leaving the tiles', () => {
    const { sections } = feed({ type: 'banner_carousel', items: [image] }, grid);
    expect(sections.map((s) => s.type)).toEqual(['unknown', 'button_grid']);
  });
});

const parseData = (data: unknown) => parseOrThrow(campusSectionsSchema, data, 'campus.sections');

describe('the campus sheet fixture', () => {
  it('reads the served feed back unchanged', () => {
    // Act
    const parsed = parseData(noBanner.data);

    // Assert
    expect(parsed).toStrictEqual(noBanner.data);
  });
});

describe('campusSectionsSchema', () => {
  let drops: [string, number][];
  beforeEach(() => {
    drops = [];
    setDropReporter((where, index) => drops.push([where, index]));
  });

  it('reads every section type back unchanged when it is well formed', () => {
    // Arrange
    const served = {
      minAppVersion: '2.1.0',
      sections: [
        { type: 'section_title', id: 'title', title: '캠퍼스' },
        { type: 'notice', id: 'notice', title: '공지', actionType: 'route', actionValue: '/notices' },
        {
          type: 'banner',
          id: 'banner',
          imageUrl: 'https://media.skkuverse.com/b.webp',
          actionType: 'webview',
          actionValue: 'https://skkuverse.com',
        },
        {
          type: 'button_grid',
          id: 'grid',
          columns: 3,
          items: [
            {
              id: 'a',
              title: 'A',
              emoji: '💬',
              actionType: 'webview',
              actionValue: 'https://x',
              webviewTitle: 'X',
              webviewColor: '#ffffff',
            },
            { id: 'b', title: 'B', emoji: '🚌', actionType: 'miniapp', actionValue: 'bus' },
          ],
        },
        { type: 'spacer', id: 'gap', height: 24 },
      ],
    };

    // Act
    const parsed = parseData(served);

    // Assert
    expect(parsed).toStrictEqual(served);
    expect(drops).toStrictEqual([]);
  });

  it('ignores a field this build does not read', () => {
    // Act
    const parsed = parseData({ minAppVersion: '2.0.0', theme: 'dark', sections: [{ type: 'spacer', id: 's', height: 8, color: 'red' }] });

    // Assert
    expect(parsed).toStrictEqual({ minAppVersion: '2.0.0', sections: [{ type: 'spacer', id: 's', height: 8 }] });
  });

  it('reads a missing or null minAppVersion as null', () => {
    // Act
    const missing = parseData({ sections: [] });
    const nulled = parseData({ minAppVersion: null, sections: [] });

    // Assert
    expect(missing).toStrictEqual({ minAppVersion: null, sections: [] });
    expect(nulled).toStrictEqual({ minAppVersion: null, sections: [] });
  });

  it('gives a section with a missing or null id the empty id', () => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'section_title', title: 't' },
        { type: 'section_title', id: null, title: 't' },
        { type: 'section_title', id: '', title: '' },
      ],
    });

    // Assert
    expect(sections).toStrictEqual([
      { type: 'section_title', id: '', title: 't' },
      { type: 'section_title', id: '', title: 't' },
      { type: 'section_title', id: '', title: '' },
    ]);
  });

  it('defaults a missing or null grid width to 4 columns and spacer to 16', () => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'button_grid', id: 'g1', items: [] },
        { type: 'button_grid', id: 'g2', columns: null, items: [] },
        { type: 'button_grid', id: 'g3', columns: 0, items: [] },
        { type: 'spacer', id: 's1' },
        { type: 'spacer', id: 's2', height: null },
        { type: 'spacer', id: 's3', height: 0 },
      ],
    });

    // Assert
    expect(sections).toStrictEqual([
      { type: 'button_grid', id: 'g1', columns: 4, items: [] },
      { type: 'button_grid', id: 'g2', columns: 4, items: [] },
      { type: 'button_grid', id: 'g3', columns: 0, items: [] },
      { type: 'spacer', id: 's1', height: 16 },
      { type: 'spacer', id: 's2', height: 16 },
      { type: 'spacer', id: 's3', height: 0 },
    ]);
  });

  it('reads an action type this build does not know as unknown, and "url" as external', () => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'notice', id: 'n1', title: 't', actionType: 'tiktok', actionValue: 'v' },
        { type: 'notice', id: 'n2', title: 't', actionType: 'url', actionValue: 'https://x' },
        { type: 'banner', id: 'b', imageUrl: 'https://x/b.webp', actionValue: 'v' },
      ],
    });

    // Assert
    expect(sections.map((s) => (s.type === 'notice' || s.type === 'banner' ? s.actionType : s.type))).toStrictEqual([
      'unknown',
      'external',
      'unknown',
    ]);
  });

  it('keeps an empty web view title and drops a null one', () => {
    // Act
    const [section] = parseData({
      sections: [
        {
          type: 'button_grid',
          id: 'g',
          columns: 2,
          items: [
            { id: 'a', title: 'A', emoji: 'e', actionType: 'webview', actionValue: 'https://x', webviewTitle: '', webviewColor: null },
          ],
        },
      ],
    }).sections;

    // Assert
    expect(section).toEqual({
      type: 'button_grid',
      id: 'g',
      columns: 2,
      items: [{ id: 'a', title: 'A', emoji: 'e', actionType: 'webview', actionValue: 'https://x', webviewTitle: '' }],
    });
    expect(section?.type === 'button_grid' ? section.items[0]?.webviewColor : 'not a grid').toBeUndefined();
  });

  it('reads a section type this build does not know as unknown, in place', () => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'poll', id: 'p', question: '?' },
        { type: 'spacer', id: 's', height: 8 },
      ],
    });

    // Assert
    expect(sections).toStrictEqual([
      { type: 'unknown', id: 'p', originalType: 'poll' },
      { type: 'spacer', id: 's', height: 8 },
    ]);
  });

  it('reads an unreadable carousel as unknown under its own id', () => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'banner_carousel', items: [image] },
        { type: 'banner_carousel', id: '', items: [image] },
        { type: 'banner_carousel', id: 7, items: [image] },
      ],
    });

    // Assert
    expect(sections.map((s) => s.type)).toStrictEqual(['unknown', 'unknown', 'unknown']);
    expect(sections.slice(0, 2)).toStrictEqual([
      { type: 'unknown', id: '', originalType: 'banner_carousel' },
      { type: 'unknown', id: '', originalType: 'banner_carousel' },
    ]);
  });

  it('drops a null or scalar section alone and reports it', () => {
    // Act
    const { sections } = parseData({ sections: [null, grid, 7, 'spacer'] });

    // Assert
    expect(sections.map((s) => s.id)).toStrictEqual(['campus_buttons']);
    expect(drops).toStrictEqual([
      ['campus.sections', 0],
      ['campus.sections', 2],
      ['campus.sections', 3],
    ]);
  });

  it('drops a null or scalar button alone and reports it', () => {
    // Act
    const [section] = parseData({ sections: [{ ...grid, items: [null, ...grid.items, 'x'] }] }).sections;

    // Assert
    expect(section).toStrictEqual(grid);
    expect(drops).toStrictEqual([
      ['campus.sections.items', 0],
      ['campus.sections.items', 2],
    ]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['an object', {}],
  ])('reads a grid with its items %s as unknown, leaving the other sections', (_name, items) => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'section_title', id: 't', title: 't' },
        { type: 'button_grid', id: 'g', items },
      ],
    });

    // Assert
    expect(sections).toStrictEqual([
      { type: 'section_title', id: 't', title: 't' },
      { type: 'unknown', id: 'g', originalType: 'button_grid' },
    ]);
  });

  it.each([
    ['null', null],
    ['a list', []],
    ['a string', 'campus'],
    ['without sections', { minAppVersion: '2.0.0' }],
    ['with sections that are not a list', { sections: {} }],
  ])('fails a body that is %s, so the fallback applies', (_name, data) => {
    // Act & Assert
    expect(() => parseData(data)).toThrow();
  });

  it('reads a string field that is missing or not a string as blank, and keeps the widget', () => {
    // Act
    const { sections } = parseData({
      minAppVersion: 2,
      sections: [
        { type: 'notice', id: 7, actionType: 'route', actionValue: null },
        { type: 'button_grid', id: 'g', columns: 2, items: [{ title: 7, actionType: 'webview', webviewTitle: 7 }] },
        { id: 'p' },
      ],
    });

    // Assert
    expect(sections).toEqual([
      { type: 'notice', id: '', title: '', actionType: 'route', actionValue: '' },
      {
        type: 'button_grid',
        id: 'g',
        columns: 2,
        items: [{ id: '', title: '', emoji: '', actionType: 'webview', actionValue: '' }],
      },
      { type: 'unknown', id: 'p', originalType: '' },
    ]);
  });

  it.each([
    ['a numeric string', '3', 3, 3],
    ['a word', 'zzz', 4, 16],
    ['a boolean', true, 4, 16],
    ['an empty string', '', 4, 16],
  ])('reads a grid width or spacer height that is %s as a number', (_name, raw, columns, height) => {
    // Act
    const { sections } = parseData({
      sections: [
        { type: 'button_grid', id: 'g', columns: raw, items: [] },
        { type: 'spacer', id: 's', height: raw },
      ],
    });

    // Assert
    expect(sections).toStrictEqual([
      { type: 'button_grid', id: 'g', columns, items: [] },
      { type: 'spacer', id: 's', height },
    ]);
  });

  it('drops a section or button that is a list, as it drops any non-object', () => {
    // Act
    const { sections } = parseData({ sections: [[], { ...grid, items: [[], ...grid.items] }] });

    // Assert
    expect(sections).toStrictEqual([grid]);
    expect(drops).toStrictEqual([
      ['campus.sections', 0],
      ['campus.sections.items', 0],
    ]);
  });
});
