/**
 * `parsePlaceDetails`, the sheet bodies of `GET /map/overlays/event/details`.
 *
 * Two enums with opposite openness, and both directions are pinned here:
 *
 * - A block `type` is OPEN. An unknown one drops that block alone, so the
 *   server can ship a sixth type before every installed build can draw it.
 * - A `kind` is CLOSED. An unknown one drops the whole detail — the server
 *   refuses anything outside the same list, so this only fires on a bug.
 *
 * The live suite at the bottom feeds it a slice of what production served, for
 * the reason `map.schema.live-overlays.test.ts` gives: a parser reading a key the server
 * does not send reports success and draws nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter, type ApiEnvelope } from '@skkuverse/shared';
import { placeDetailsSchema } from './place-detail.schema';
import detailsLive from '../__fixtures__/map-overlays-event-details-live.json';

// The hand parser's call shape, over the schema that replaced it (migrate-map-data 4.4).
const parsePlaceDetails = (envelope: ApiEnvelope<unknown>) =>
  parseOrThrow(placeDetailsSchema, envelope.data, 'eventmap.details');

const ko = (s: string) => ({ ko: s, en: s });

function envelope(details: Record<string, unknown>): ApiEnvelope<unknown> {
  return { meta: { lang: 'ko' }, data: { details } } as unknown as ApiEnvelope<unknown>;
}

function wire(overrides: Record<string, unknown> = {}) {
  return {
    placeId: 'p',
    kind: 'foodTruck',
    org: null,
    isUnion: false,
    locationLabel: null,
    actions: [],
    blocks: [],
    ...overrides,
  };
}

const parseOne = (overrides: Record<string, unknown> = {}) =>
  parsePlaceDetails(envelope({ p: wire(overrides) })).p;

describe('parsePlaceDetails', () => {
  it('keys each detail by its own placeId', () => {
    const out = parsePlaceDetails(envelope({ a: wire({ placeId: 'a' }), b: wire({ placeId: 'b' }) }));
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('answers an empty record for a closed festival or a missing envelope', () => {
    expect(parsePlaceDetails(envelope({}))).toEqual({});
    expect(parsePlaceDetails({ data: null } as unknown as ApiEnvelope<unknown>)).toEqual({});
  });

  it('drops a whole detail whose kind this build does not know', () => {
    expect(parseOne({ kind: 'spaceship' })).toBeUndefined();
    expect(parseOne({ placeId: '' })).toBeUndefined();
  });

  it('drops an unknown block type alone and keeps the rest of the body', () => {
    const detail = parseOne({
      blocks: [
        { type: 'carousel', id: 'x', title: null },
        { type: 'text', id: 't', title: null, body: ko('소개') },
      ],
    });
    expect(detail?.blocks.map((b) => b.id)).toEqual(['t']);
  });

  it('drops a block missing what it draws, and a list with no readable row', () => {
    const detail = parseOne({
      blocks: [
        { type: 'text', id: 'no-body', title: null },
        { type: 'table', id: 'empty', title: null, rows: [{ label: ko('닭꼬치') }] },
        { type: 'image', id: 'http', title: null, url: 'http://media.skkuverse.com/a.jpg', caption: null },
        { type: 'notice', id: 'n', title: null, items: [ko('현금만 받아요'), { en: 'no ko' }] },
      ],
    });
    expect(detail?.blocks).toEqual([{ type: 'notice', id: 'n', title: null, items: [ko('현금만 받아요')] }]);
  });

  it('drops an unknown or malformed action alone', () => {
    const detail = parseOne({
      actions: [
        { type: 'tiktok', id: 'x', label: ko('틱톡') },
        { type: 'link', id: 'bad', label: ko('링크'), url: 'javascript:alert(1)' },
        {
          type: 'instagram',
          id: 'ig',
          label: ko('인스타'),
          profileUrl: 'https://www.instagram.com/skku',
          postUrl: null,
        },
      ],
    });
    expect(detail?.actions.map((a) => a.id)).toEqual(['ig']);
  });
});

describe('placeDetailsSchema', () => {
  const parseData = (data: unknown) => parseOrThrow(placeDetailsSchema, data, 'eventmap.details');
  let drops: [string, number][];
  beforeEach(() => {
    drops = [];
    setDropReporter((where, index) => drops.push([where, index]));
  });

  it.each([
    ['null', null],
    ['a string', 'details'],
    ['a list', []],
    ['an object without details', {}],
    ['an object whose details are null', { details: null }],
    ['an object whose details are a string', { details: 'x' }],
    ['an object whose details are a number', { details: 3 }],
  ])('reads a body that is %s as no details', (_name, data) => {
    // Act & Assert
    expect(parseData(data)).toStrictEqual({});
  });

  it('reads a list of details as it reads a record of them', () => {
    // Act
    const out = parseData({ details: [wire({ placeId: 'a' }), wire({ placeId: 'b' })] });

    // Assert
    expect(Object.keys(out)).toStrictEqual(['a', 'b']);
  });

  it('keys a detail by its own placeId, the later of two winning', () => {
    // Act
    const out = parseData({
      details: { x: wire({ placeId: 'p', isUnion: false }), y: wire({ placeId: 'p', isUnion: true }), z: wire({ placeId: 'q' }) },
    });

    // Assert
    expect(Object.keys(out)).toStrictEqual(['p', 'q']);
    expect(out.p?.isUnion).toBe(true);
  });

  it('skips an unknown kind silently and reports a detail it cannot read', () => {
    // Act
    const out = parseData({
      details: {
        a: wire({ placeId: 'a', kind: 'spaceship' }),
        b: null,
        c: wire({ placeId: '' }),
        d: wire({ placeId: 7 }),
        e: 'detail',
        f: wire({ placeId: 'f' }),
        g: wire({ placeId: 'g', kind: undefined }),
      },
    });

    // Assert
    expect(Object.keys(out)).toStrictEqual(['f']);
    expect(drops).toStrictEqual([
      ['eventmap.details', 1],
      ['eventmap.details', 2],
      ['eventmap.details', 3],
      ['eventmap.details', 4],
    ]);
  });

  it('reads a well-formed detail of every kind back unchanged', () => {
    // Arrange
    const kinds = ['pub', 'booth', 'promo', 'foodTruck', 'goods', 'facility', 'stage', 'etc'];
    const details = Object.fromEntries(kinds.map((kind) => [kind, wire({ placeId: kind, kind })]));

    // Act
    const out = parseData({ details });

    // Assert
    expect(out).toStrictEqual(details);
  });

  it('reads isUnion as true only for true itself', () => {
    // Act
    const out = parseData({
      details: [
        wire({ placeId: 'a', isUnion: true }),
        wire({ placeId: 'b', isUnion: 'true' }),
        wire({ placeId: 'c', isUnion: 1 }),
        wire({ placeId: 'd', isUnion: undefined }),
      ],
    });

    // Assert
    expect(Object.values(out).map((d) => d.isUnion)).toStrictEqual([true, false, false, false]);
  });

  it('reads an i18n text without its ko as null, and fills a missing en from ko', () => {
    // Act
    const out = parseData({
      details: [
        wire({ placeId: 'a', org: { ko: '총학', en: '', zh: '' }, locationLabel: { en: 'only en' } }),
        wire({ placeId: 'b', org: { ko: '총학', en: 'Council', zh: '学生会' }, locationLabel: undefined }),
        wire({ placeId: 'c', org: 'council', locationLabel: { ko: '' } }),
      ],
    });

    // Assert
    expect(Object.values(out).map((d) => [d.org, d.locationLabel])).toStrictEqual([
      [{ ko: '총학', en: '총학' }, null],
      [{ ko: '총학', en: 'Council', zh: '学生会' }, null],
      [null, null],
    ]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['an object', { 0: { type: 'text', id: 't', title: null, body: ko('b') } }],
    ['a string', 'blocks'],
  ])('reads actions and blocks that are %s as none', (_name, list) => {
    // Act
    const detail = parseOne({ actions: list, blocks: list });

    // Assert
    expect(detail).toStrictEqual(wire());
  });

  it('reads each action field the way the sheet draws it', () => {
    // Act
    const detail = parseOne({
      actions: [
        { type: 'instagram', id: 'ig1', label: ko('인스타'), profileUrl: 'https://instagram.com/a', postUrl: 'http://instagram.com/p' },
        { type: 'instagram', id: 'ig2', label: ko('인스타'), profileUrl: 'https://instagram.com/a' },
        { type: 'instagram', id: 'ig3', label: ko('인스타'), profileUrl: 'https://' },
        { type: 'link', id: '', label: ko('링크'), url: 'https://x.com' },
        { type: 'link', id: 'nolabel', label: { en: 'Link' }, url: 'https://x.com' },
        { type: 'link', id: 'web', label: ko('링크'), url: 'https://x.com/a b' },
        null,
        'link',
      ],
    });

    // Assert
    expect(detail?.actions).toStrictEqual([
      { type: 'instagram', id: 'ig1', label: ko('인스타'), profileUrl: 'https://instagram.com/a', postUrl: null },
      { type: 'instagram', id: 'ig2', label: ko('인스타'), profileUrl: 'https://instagram.com/a', postUrl: null },
      { type: 'link', id: 'web', label: ko('링크'), url: 'https://x.com/a b' },
    ]);
  });

  it('reads each block field the way the sheet draws it', () => {
    // Act
    const detail = parseOne({
      blocks: [
        { type: 'text', id: '', title: null, body: ko('no id') },
        { type: 'text', id: 'blank-body', title: null, body: { ko: '' } },
        { type: 'text', id: 'untitled', body: ko('본문') },
        {
          type: 'list',
          id: 'list',
          title: ko('게임'),
          items: [
            { emoji: '', title: ko('다트') },
            { emoji: 7, title: ko('링던지기'), description: ko('세 번') },
            { emoji: '🎯', description: ko('no title') },
            null,
          ],
        },
        { type: 'list', id: 'empty-list', title: null, items: [{ emoji: '🎯' }] },
        { type: 'table', id: 'rows', title: null, rows: [{ label: ko('닭꼬치'), value: ko('5,000원') }, { label: ko('x') }, 'row'] },
        { type: 'image', id: 'photo', url: 'https://media.skkuverse.com/a.jpg' },
        { type: 'image', id: 'no-url', title: null, caption: ko('사진') },
        { type: 'notice', id: 'notes', title: null, items: [ko('현금만'), 'cash', null, { ko: '' }] },
        { type: 'notice', id: 'no-notes', title: null, items: 'cash' },
        null,
        { type: 'carousel', id: 'c' },
        { id: 'typeless' },
      ],
    });

    // Assert
    expect(detail?.blocks).toStrictEqual([
      { type: 'text', id: 'untitled', title: null, body: ko('본문') },
      {
        type: 'list',
        id: 'list',
        title: ko('게임'),
        items: [
          { emoji: null, title: ko('다트'), description: null },
          { emoji: null, title: ko('링던지기'), description: ko('세 번') },
        ],
      },
      { type: 'table', id: 'rows', title: null, rows: [{ label: ko('닭꼬치'), value: ko('5,000원') }] },
      { type: 'image', id: 'photo', title: null, url: 'https://media.skkuverse.com/a.jpg', caption: null },
      { type: 'notice', id: 'notes', title: null, items: [ko('현금만')] },
    ]);
  });

  it('reports an action, block or row it drops, and skips an unknown type silently', () => {
    // Act
    parseOne({
      actions: [{ type: 'tiktok', id: 'x', label: ko('틱톡') }, { type: 'link', id: 'bad', label: ko('링크'), url: 'http://x' }],
      blocks: [
        { type: 'carousel', id: 'c' },
        { type: 'list', id: 'list', title: null, items: [{ title: ko('다트') }, { emoji: '🎯' }] },
        { type: 'text', id: 'no-body', title: null },
      ],
    });

    // Assert
    expect(drops).toStrictEqual([
      ['eventmap.actions', 1],
      ['eventmap.list.items', 1],
      ['eventmap.blocks', 2],
    ]);
  });
});

describe('the live details, parsed whole', () => {
  const RAW = detailsLive.data.details as Record<string, { blocks: unknown[] }>;
  const OUT = parsePlaceDetails(detailsLive as unknown as ApiEnvelope<unknown>);

  it('keeps every detail and every block the fixture holds', () => {
    // Nothing dropped: a drop here is the parser rejecting something real.
    expect(Object.keys(OUT).sort()).toEqual(Object.keys(RAW).sort());
    for (const [id, raw] of Object.entries(RAW)) {
      expect(OUT[id]?.blocks).toHaveLength(raw.blocks.length);
    }
  });

  it('reads every detail back unchanged', () => {
    // Assert
    expect(OUT).toStrictEqual(RAW);
  });

  it('reads a truck as its menu, then its captioned photos', () => {
    const truck = OUT['eskara-2026-truck-oyabong'];
    expect(truck?.kind).toBe('foodTruck');
    expect(truck?.blocks[0]?.type).toBe('table');
    for (const block of truck?.blocks.slice(1) ?? []) {
      expect(block.type).toBe('image');
      if (block.type !== 'image') continue;
      expect(block.url.startsWith('https://media.skkuverse.com/')).toBe(true);
      expect(block.caption?.ko).toBeTruthy();
    }
  });
});
