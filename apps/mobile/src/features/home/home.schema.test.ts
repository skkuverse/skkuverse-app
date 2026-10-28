import { describe, it, expect } from 'vitest';
import { DEFAULT_AUTO_ROTATE_SEC, DEFAULT_BANNER_ASPECT_RATIO } from '@skkuverse/shared';
import { homeLayoutSchema } from './home.schema';

/**
 * The server validates its own layout at boot; this side must instead degrade.
 * Every case is "the server sent something this build does not expect — does
 * the home screen still render?"
 */

const image = {
  type: 'image',
  id: 'eskara',
  imageUrl: 'https://media.skkuverse.com/home/banners/eskara-00000000.jpg',
  alt: 'ESKARA',
  actionType: 'miniapp',
  actionValue: 'eskara-2026',
};

const carousel = {
  type: 'banner_carousel',
  id: 'home_top',
  aspectRatio: 2.25,
  autoRotateSec: 5,
  items: [image, { type: 'default' }],
};

const grid = {
  type: 'tile_grid',
  id: 'games',
  title: '미니게임',
  tiles: [
    { kind: 'game', id: 'wave-run' },
    { kind: 'miniapp', id: 'mukja' },
  ],
};

const link = {
  kind: 'link',
  id: 'campus-map',
  title: '캠퍼스 지도',
  icon: { kind: 'emoji', emoji: '\u{1F5FA}\u{FE0F}' },
  actionType: 'route',
  actionValue: '/(tabs)/campus',
};

describe('homeLayoutSchema', () => {
  it('parses the server payload', () => {
    expect(homeLayoutSchema.parse({ version: 1, sections: [carousel, grid] })).toEqual({
      version: 1,
      sections: [
        {
          type: 'banner_carousel',
          id: 'home_top',
          aspectRatio: 2.25,
          autoRotateSec: 5,
          items: [
            {
              type: 'image',
              id: 'eskara',
              imageUrl: image.imageUrl,
              alt: 'ESKARA',
              action: { actionType: 'miniapp', actionValue: 'eskara-2026' },
            },
            { type: 'default' },
          ],
        },
        grid,
      ],
    });
  });

  it('rejects a payload that is not a layout', () => {
    expect(homeLayoutSchema.safeParse(null).success).toBe(false);
    expect(homeLayoutSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(homeLayoutSchema.safeParse([]).success).toBe(false);
  });

  it('skips section and banner item types newer than this build', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [
        { type: 'video_hero', id: 'x' },
        { ...carousel, items: [{ type: 'lottie', id: 'y' }, { type: 'default' }] },
      ],
    });
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0]).toMatchObject({ items: [{ type: 'default' }] });
  });

  it('drops a banner with no usable image, keeps one with an unknown action inert', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [
        {
          ...carousel,
          items: [
            { ...image, id: 'a', imageUrl: 'http://insecure.example/a.jpg' },
            { ...image, id: 'b', imageUrl: undefined },
            { ...image, id: 'c', actionType: 'teleport' },
          ],
        },
      ],
    });
    const items = (layout.sections[0] as { items: unknown[] }).items;
    expect(items).toEqual([{ type: 'image', id: 'c', imageUrl: image.imageUrl, alt: 'ESKARA' }]);
  });

  it('falls back to defaults for an out-of-range slot shape or rotation', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [{ ...carousel, aspectRatio: 0, autoRotateSec: 1 }],
    });
    expect(layout.sections[0]).toMatchObject({
      aspectRatio: DEFAULT_BANNER_ASPECT_RATIO,
      autoRotateSec: DEFAULT_AUTO_ROTATE_SEC,
    });
  });

  it('keeps autoRotateSec 0 as "off"', () => {
    const layout = homeLayoutSchema.parse({ version: 1, sections: [{ ...carousel, autoRotateSec: 0 }] });
    expect(layout.sections[0]).toMatchObject({ autoRotateSec: 0 });
  });

  it('drops a grid with no tiles and reads a blank title as none', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [
        { ...grid, tiles: [] },
        { ...grid, id: 'main', title: '', tiles: [{ kind: 'miniapp', id: 'mukja' }, 3] },
      ],
    });
    expect(layout.sections).toEqual([
      { type: 'tile_grid', id: 'main', tiles: [{ kind: 'miniapp', id: 'mukja' }] },
    ]);
  });

  it('parses a link tile, nesting its action', () => {
    const layout = homeLayoutSchema.parse({ version: 1, sections: [{ ...grid, tiles: [link] }] });
    expect(layout.sections[0]).toMatchObject({
      tiles: [
        {
          kind: 'link',
          id: 'campus-map',
          title: '캠퍼스 지도',
          icon: link.icon,
          action: { actionType: 'route', actionValue: '/(tabs)/campus' },
        },
      ],
    });
  });

  it('drops a tile of an unknown kind or with nothing to press, keeping the rest', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [
        {
          ...grid,
          tiles: [
            { kind: 'screen', id: 'campus' },
            { kind: 'game' },
            { ...link, id: 'a', title: undefined },
            { ...link, id: 'b', icon: { kind: 'svg', src: 'x' } },
            { ...link, id: 'c', actionType: 'teleport' },
            { ...link, id: 'd', actionValue: '' },
            { kind: 'game', id: 'wave-run' },
          ],
        },
      ],
    });
    expect(layout.sections[0]).toMatchObject({ tiles: [{ kind: 'game', id: 'wave-run' }] });
  });

  it('drops a grid whose every tile is unusable', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [{ ...grid, tiles: [{ kind: 'screen', id: 'campus' }] }],
    });
    expect(layout.sections).toEqual([]);
  });

  it('skips the retired miniapp_grid like any section it does not know', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [{ type: 'miniapp_grid', id: 'main', miniAppIds: ['inja', 'mukja'] }, grid],
    });
    expect(layout.sections).toHaveLength(1);
  });
});

describe('homeLayoutSchema — miniapp_feed', () => {
  const feed = {
    type: 'miniapp_feed',
    id: 'eskara_feed',
    miniAppId: 'eskara-2026',
    title: '에스카라 실시간 소식',
    limit: 3,
  };

  it('parses a feed section', () => {
    const layout = homeLayoutSchema.parse({ version: 1, sections: [carousel, feed, grid] });
    expect(layout.sections[1]).toEqual(feed);
  });

  // WHY: a parsed layout passed back through the parser must keep every section.
  it('round-trips through its own output', () => {
    const once = homeLayoutSchema.parse({ version: 1, sections: [feed] });
    const twice = homeLayoutSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('reads a missing title as none and defaults a missing or bad limit to 3', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [
        { type: 'miniapp_feed', id: 'a', miniAppId: 'eskara-2026' },
        { type: 'miniapp_feed', id: 'b', miniAppId: 'eskara-2026', limit: 0 },
        { type: 'miniapp_feed', id: 'c', miniAppId: 'eskara-2026', limit: 99 },
        { type: 'miniapp_feed', id: 'd', miniAppId: 'eskara-2026', limit: 2.5 },
      ],
    });
    expect(layout.sections).toEqual([
      { type: 'miniapp_feed', id: 'a', miniAppId: 'eskara-2026', limit: 3 },
      { type: 'miniapp_feed', id: 'b', miniAppId: 'eskara-2026', limit: 3 },
      { type: 'miniapp_feed', id: 'c', miniAppId: 'eskara-2026', limit: 3 },
      { type: 'miniapp_feed', id: 'd', miniAppId: 'eskara-2026', limit: 3 },
    ]);
  });

  it('drops a feed with no mini app, keeping the rest of home', () => {
    const layout = homeLayoutSchema.parse({
      version: 1,
      sections: [carousel, { type: 'miniapp_feed', id: 'x' }, grid],
    });
    expect(layout.sections.map((s) => s.id)).toEqual(['home_top', 'games']);
  });
});
