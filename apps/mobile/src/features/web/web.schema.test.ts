import { describe, it, expect } from 'vitest';
import { DEFAULT_SHELL } from '@skkuverse/miniapp/protocol';
import { miniAppDetailSchema, miniAppFeedSchema, miniAppIndexSchema } from './web.schema';
import indexKo from './__fixtures__/miniapp-index.production-ko.json';
import eskara from './__fixtures__/miniapp-detail.eskara-2026.json';
import hssc from './__fixtures__/miniapp-detail.hssc.json';
import feedKo from './__fixtures__/miniapp-feed.production-ko.json';

/**
 * The registry moved server-side, so there is no bundled JSON left to assert
 * referential integrity against — that check now runs at server boot
 * (skkuverse-server `assertValidRegistry`, which throws).
 *
 * What matters on this side is the opposite property: an untrusted payload must
 * degrade rather than throw. Every case here is "the server sent something
 * wrong; does the app still render?"
 */

const validEntry = {
  id: 'hssc',
  name: '인사캠 총학생회',
  shortName: '인사캠 총학',
  order: 10,
  homeLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-home.png' },
  shellLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-shell.png' },
};

describe('miniAppIndexSchema', () => {
  it('parses a well-formed index', () => {
    const parsed = miniAppIndexSchema.parse({ version: 1, miniApps: [validEntry] });
    expect(parsed.version).toBe(1);
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0]).toMatchObject({
      id: 'hssc',
      name: '인사캠 총학생회',
      shortName: '인사캠 총학',
      homeLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-home.png' },
      shellLogo: { kind: 'remote', uri: 'https://skkuverse.com/miniapps/hssc-shell.png' },
    });
  });

  it("reads the server's published index, ordered", () => {
    // Act
    const parsed = miniAppIndexSchema.parse(indexKo.data);

    // Assert
    expect(parsed.miniApps.map((m) => [m.id, m.order])).toEqual([
      ['eskara-2026', 4],
      ['mukja', 8],
      ['hssc', 10],
    ]);
  });

  it('gives an entry without an `order` its position as sent, before any drop', () => {
    // Act
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [{ ...validEntry, id: 'late', order: 5 }, null, { ...validEntry, id: 'third', order: undefined }],
    });

    // Assert
    expect(parsed.miniApps.map((m) => [m.id, m.order])).toEqual([
      ['third', 2],
      ['late', 5],
    ]);
  });

  it('sorts by `order`, not by array position', () => {
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [
        { ...validEntry, id: 'c', order: 30 },
        { ...validEntry, id: 'a', order: 10 },
        { ...validEntry, id: 'b', order: 20 },
      ],
    });
    expect(parsed.miniApps.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops only the malformed entries, keeping the rest of the grid', () => {
    // The whole point of tolerant parsing: one bad row costs one tile.
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [
        validEntry,
        null,
        'nonsense',
        { name: 'no id', order: 1 },
        { id: 'NoUpperCase', name: 'bad slug', order: 2 },
        { id: 'noname', order: 3 },
        { ...validEntry, id: 'good2' },
      ],
    });
    expect(parsed.miniApps.map((m) => m.id)).toEqual(['hssc', 'good2']);
  });

  it('keeps an entry whose homeLogo is unusable, with homeLogo null', () => {
    // A missing logo is a cosmetic problem; dropping the tile would hide a
    // working mini-app over an image.
    for (const homeLogo of [
      undefined,
      null,
      { kind: 'bundled', key: 'hssc' },
      { kind: 'remote' },
      { kind: 'remote', uri: 'javascript:alert(1)' },
      { kind: 'remote', uri: '/miniapps/hssc.png' },
      { kind: 'emoji' },
      { kind: 'emoji', emoji: '' },
    ]) {
      const parsed = miniAppIndexSchema.parse({
        version: 1,
        miniApps: [{ ...validEntry, homeLogo }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0].homeLogo).toBeNull();
    }
  });

  it('keeps an entry whose shellLogo is unusable, with shellLogo null', () => {
    for (const shellLogo of [
      undefined,
      null,
      { kind: 'bundled', key: 'hssc' },
      { kind: 'remote', uri: 'javascript:alert(1)' },
    ]) {
      const parsed = miniAppIndexSchema.parse({
        version: 1,
        miniApps: [{ ...validEntry, shellLogo }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0].shellLogo).toBeNull();
    }
  });

  it('parses homeLogo and shellLogo independently — one unusable does not null the other', () => {
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [
        {
          ...validEntry,
          homeLogo: { kind: 'emoji', emoji: '🌊' },
          shellLogo: { kind: 'remote', uri: 'javascript:alert(1)' },
        },
      ],
    });
    expect(parsed.miniApps[0].homeLogo).toEqual({ kind: 'emoji', emoji: '🌊' });
    expect(parsed.miniApps[0].shellLogo).toBeNull();
  });

  it('parses an emoji logo for both homeLogo and shellLogo', () => {
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [
        {
          ...validEntry,
          homeLogo: { kind: 'emoji', emoji: '😋' },
          shellLogo: { kind: 'emoji', emoji: '😋' },
        },
      ],
    });
    expect(parsed.miniApps[0].homeLogo).toEqual({ kind: 'emoji', emoji: '😋' });
    expect(parsed.miniApps[0].shellLogo).toEqual({ kind: 'emoji', emoji: '😋' });
  });

  it('ignores unknown fields so the server can add them additively', () => {
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [{ ...validEntry, brandNewField: { nested: true } }],
      somethingElse: 123,
    });
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0]).not.toHaveProperty('brandNewField');
  });

  it('falls back to the known version when the server omits it', () => {
    expect(miniAppIndexSchema.parse({ miniApps: [] }).version).toBe(1);
  });

  it('keeps `hidden: true`, keeping the entry in the registry', () => {
    const parsed = miniAppIndexSchema.parse({
      version: 1,
      miniApps: [{ ...validEntry, hidden: true }],
    });
    expect(parsed.miniApps).toHaveLength(1);
    expect(parsed.miniApps[0].hidden).toBe(true);
  });

  it('omits `hidden` when absent', () => {
    const parsed = miniAppIndexSchema.parse({ version: 1, miniApps: [validEntry] });
    expect(parsed.miniApps[0]).not.toHaveProperty('hidden');
  });

  it('drops a non-true `hidden` value rather than coercing it, keeping the entry', () => {
    for (const hidden of ['yes', 1, false]) {
      const parsed = miniAppIndexSchema.parse({
        version: 1,
        miniApps: [{ ...validEntry, hidden }],
      });
      expect(parsed.miniApps).toHaveLength(1);
      expect(parsed.miniApps[0]).not.toHaveProperty('hidden');
    }
  });
});

describe('miniAppDetailSchema', () => {
  const validDetail = {
    version: 1,
    id: 'skkuzine',
    startUrl: 'https://webzine.skku.edu/skkuzine/index.do',
    verified: true,
    description: '성균웹진',
    relatedLinks: [
      { url: 'https://linktr.ee/skku_webzine' },
      { label: '인스타그램', url: 'https://www.instagram.com/skku_webzine' },
    ],
    noticeBanner: { title: '6월호 발행', subtitle: '방금 · 공지' },
  };

  it("reads the server's published detail", () => {
    // Act
    const parsed = miniAppDetailSchema.parse(eskara.data);

    // Assert
    expect(parsed).toEqual({
      version: 1,
      id: 'eskara-2026',
      startUrl: 'https://eskara.miniapp.skkuverse.com/eskara',
      verified: true,
      relatedLinks: [],
      shell: { bar: 'bottom', header: 'opaque', statusBar: 'dark', background: '#FFFFFF' },
    });
  });

  it('reads related links that are not a list as none', () => {
    for (const relatedLinks of [undefined, null, 'links', { url: 'https://ok.test' }]) {
      // Act
      const parsed = miniAppDetailSchema.parse({ ...validDetail, relatedLinks });

      // Assert
      expect(parsed.relatedLinks).toEqual([]);
    }
  });

  it('parses a well-formed detail', () => {
    const parsed = miniAppDetailSchema.parse(validDetail);
    expect(parsed).toMatchObject({
      id: 'skkuzine',
      startUrl: 'https://webzine.skku.edu/skkuzine/index.do',
      verified: true,
    });
    expect(parsed.relatedLinks).toHaveLength(2);
    expect(parsed.noticeBanner?.title).toBe('6월호 발행');
  });

  it('rejects a detail without a usable startUrl', () => {
    // startUrl goes straight into a WebView, so a non-http scheme counts as
    // absent rather than being loaded.
    for (const startUrl of [
      undefined,
      null,
      '',
      42,
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      '/relative/path',
    ]) {
      expect(miniAppDetailSchema.safeParse({ ...validDetail, startUrl }).success).toBe(false);
    }
  });

  it('rejects a missing or non-slug id', () => {
    expect(miniAppDetailSchema.safeParse({ ...validDetail, id: undefined }).success).toBe(false);
    expect(miniAppDetailSchema.safeParse({ ...validDetail, id: 'Not A Slug' }).success).toBe(false);
  });

  it('drops non-http related links but keeps the rest', () => {
    const parsed = miniAppDetailSchema.parse({
      ...validDetail,
      relatedLinks: [
        { url: 'https://ok.test' },
        { url: 'javascript:alert(1)' },
        { label: 'no url' },
        'nonsense',
        { url: 'https://also-ok.test', label: 'x' },
      ],
    });
    expect(parsed.relatedLinks.map((l) => l.url)).toEqual([
      'https://ok.test',
      'https://also-ok.test',
    ]);
  });

  it('treats a half-filled noticeBanner as absent', () => {
    // Rendering a banner with a blank subtitle reads as a bug, not a notice.
    expect(
      miniAppDetailSchema.parse({ ...validDetail, noticeBanner: { title: 'only' } })
        .noticeBanner,
    ).toBeUndefined();
  });

  it('defaults `verified` to false rather than truthy-coercing', () => {
    // The badge asserts identity; anything but a literal true must not earn it.
    for (const verified of [undefined, null, 'true', 1, {}]) {
      expect(miniAppDetailSchema.parse({ ...validDetail, verified }).verified).toBe(
        false,
      );
    }
  });

  it('rejects a malformed payload instead of throwing', () => {
    for (const raw of [null, undefined, 42, 'nope', []]) {
      expect(() => miniAppDetailSchema.safeParse(raw)).not.toThrow();
      expect(miniAppDetailSchema.safeParse(raw).success).toBe(false);
    }
  });

  describe('shell', () => {
    const shellOf = (shell: unknown) =>
      miniAppDetailSchema.parse({ ...validDetail, shell }).shell;

    it('is the protocol default when the server sends none', () => {
      // An opt-out surface: a server that never mentions `shell` keeps every
      // mini-app on the default bottom bar and opaque header.
      expect(miniAppDetailSchema.parse(validDetail).shell).toEqual(DEFAULT_SHELL);
    });

    it('keeps a complete, valid shell as sent', () => {
      const shell = { bar: 'top', header: 'overlay', statusBar: 'light', background: '#101820' };
      expect(shellOf(shell)).toEqual(shell);
    });

    it('fills the fields a partial shell leaves out from the default', () => {
      expect(shellOf({ bar: 'top' })).toEqual({ ...DEFAULT_SHELL, bar: 'top' });
      expect(shellOf({ header: 'overlay' })).toEqual({ ...DEFAULT_SHELL, header: 'overlay' });
    });

    it("reads the registry's old `hide` as the protocol's `none`", () => {
      // A cached v2 detail, or a server predating the protocol shell, still says hide.
      expect(shellOf({ bar: 'hide' })?.bar).toBe('none');
      expect(shellOf({ bar: 'none' })?.bar).toBe('none');
    });

    it('keeps the other fields of a shell that says `hide`', () => {
      // Act
      const shell = shellOf({ bar: 'hide', header: 'overlay', statusBar: 'light', background: '#101820' });

      // Assert
      expect(shell).toEqual({ bar: 'none', header: 'overlay', statusBar: 'light', background: '#101820' });
    });

    it('renames only the exact `hide`', () => {
      for (const bar of ['HIDE', 'hide ', ['hide'], { hide: true }]) {
        // Act
        const shell = shellOf({ bar, header: 'overlay' });

        // Assert
        expect(shell).toEqual({ ...DEFAULT_SHELL, header: 'overlay' });
      }
    });

    it('drops each bad field on its own, keeping the valid ones', () => {
      expect(
        shellOf({ bar: 'left', header: 'overlay', statusBar: 42, background: 'red' }),
      ).toEqual({ ...DEFAULT_SHELL, header: 'overlay' });
    });

    it('falls back to the default for a shell that is not an object', () => {
      for (const shell of [null, 'top', 42, true, ['top']]) {
        expect(shellOf(shell)).toEqual(DEFAULT_SHELL);
      }
    });

    it('drops unknown shell keys', () => {
      expect(shellOf({ bar: 'top', extra: 1 })).toEqual({ ...DEFAULT_SHELL, bar: 'top' });
    });

    it('normalises the background to upper case', () => {
      expect(shellOf({ background: '#abcdef' })?.background).toBe('#ABCDEF');
    });
  });
});

describe('miniAppFeedSchema', () => {
  const entry = {
    id: 'n1',
    title: '[공연] 메인 공연 시작',
    body: '대운동장에서 지금 시작해요',
    sentAt: '2026-10-01T11:00:00.000Z',
    actionType: 'route',
    actionValue: '/miniapp-feed/eskara-2026',
  };

  it("reads the server's published feed, every entry and action kept", () => {
    // Act
    const feed = miniAppFeedSchema.parse(feedKo.data);

    // Assert
    expect(feed).toEqual(feedKo.data);
  });

  it('parses the public feed', () => {
    expect(miniAppFeedSchema.parse([entry])).toEqual([entry]);
  });

  it('keeps an entry with no action', () => {
    const { actionType: _a, actionValue: _v, ...bare } = entry;
    expect(miniAppFeedSchema.parse([bare])).toEqual([bare]);
  });

  it('keeps an action type this build does not know, for the reader to decide', () => {
    // Act
    const feed = miniAppFeedSchema.parse([{ ...entry, actionType: 'teleport' }]);

    // Assert
    expect(feed).toEqual([{ ...entry, actionType: 'teleport' }]);
  });

  it('drops malformed entries, keeping the rest', () => {
    expect(
      miniAppFeedSchema.parse([
        entry,
        { ...entry, id: '' },
        { ...entry, title: 3 },
        { ...entry, sentAt: 'not a date' },
        null,
        'x',
      ]).map((e) => e.id),
    ).toEqual(['n1']);
  });

  it('treats a non-array as an empty feed', () => {
    expect(miniAppFeedSchema.parse(null)).toEqual([]);
    expect(miniAppFeedSchema.parse({ data: [] })).toEqual([]);
  });
});

describe('the published fixtures', () => {
  it.each([
    ['miniapp-index.production-ko', (raw: unknown) => miniAppIndexSchema.parse(raw), indexKo.data],
    ['miniapp-detail.eskara-2026', (raw: unknown) => miniAppDetailSchema.parse(raw), eskara.data],
    ['miniapp-detail.hssc', (raw: unknown) => miniAppDetailSchema.parse(raw), hssc.data],
    ['miniapp-feed.production-ko', (raw: unknown) => miniAppFeedSchema.parse(raw), feedKo.data],
  ])('%s reads whole', (_name, parse, data) => {
    // Act & Assert
    expect(parse(data)).toMatchSnapshot();
  });
});
