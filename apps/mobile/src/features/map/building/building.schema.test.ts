/**
 * The building schemas over every committed server fixture, plus the tolerance cases. The snapshots
 * were written by the hand parser before the port, and the zod schemas reproduce every one.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { buildingDetailSchema, buildingSearchSchema } from './building.schema';
import facility from './__fixtures__/building-detail.facility.json';
import withConnections from './__fixtures__/building-detail.with-connections.json';
import buildingHit from './__fixtures__/building-search.building-hit.json';
import empty from './__fixtures__/building-search.empty.json';
import spaceHit from './__fixtures__/building-search.space-hit.json';

// The client's call shapes: the detail reads the envelope's data, the search the whole envelope.
const parseDetail = (data: unknown) => parseOrThrow(buildingDetailSchema, data, 'GET /building/:id');
const parseSearch = (envelope: unknown) => parseOrThrow(buildingSearchSchema, envelope, 'GET /building/search');

const BUILDING = withConnections.data.building;
const FLOOR = withConnections.data.floors[0];
const CONNECTION = withConnections.data.connections[0];
const SPACE_GROUP = buildingHit.data.spaces[0];

const detailWith = (building: Record<string, unknown>) => parseDetail({ building: { ...BUILDING, ...building } }).building;
const searchWith = (meta: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  parseSearch({ meta: { ...buildingHit.meta, ...meta }, data: { ...buildingHit.data, ...data } });
const spaceGroupWith = (group: Record<string, unknown>) =>
  searchWith({}, { spaces: [{ ...SPACE_GROUP, ...group }] }).spaces[0];

describe('building fixtures', () => {
  it.each([
    ['facility', facility],
    ['with-connections', withConnections],
  ])('detail %s', (_name, fixture) => {
    expect(parseDetail(fixture.data)).toMatchSnapshot();
  });

  it.each([
    ['building-hit', buildingHit],
    ['empty', empty],
    ['space-hit', spaceHit],
  ])('search %s', (_name, fixture) => {
    expect(parseSearch(fixture)).toMatchSnapshot();
  });
});

describe('a building', () => {
  it('reads the GeoJSON position as lng, lat', () => {
    // Act
    const building = detailWith({ location: { type: 'Point', coordinates: [126.99, 37.58] } });

    // Assert
    expect(building).toMatchObject({ lat: 37.58, lng: 126.99 });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['without coordinates', { type: 'Point' }],
    ['with null coordinates', { type: 'Point', coordinates: null }],
    ['with empty coordinates', { type: 'Point', coordinates: [] }],
  ])('reads a location that is %s as 0, 0', (_name, location) => {
    // Act
    const building = detailWith({ location });

    // Assert
    expect(building).toMatchObject({ lat: 0, lng: 0 });
  });

  it('reads a null number or name as absent, and keeps an empty one', () => {
    // Act
    const nulls = detailWith({ buildNo: null, displayNo: null });
    const empties = detailWith({ buildNo: '', displayNo: '' });

    // Assert
    expect(nulls.buildNo).toBeUndefined();
    expect(nulls.displayNo).toBeUndefined();
    expect(empties).toMatchObject({ buildNo: '', displayNo: '' });
  });

  it.each([
    ['absent', undefined, 'building'],
    ['null', null, 'building'],
    ['empty', '', ''],
    ['a new kind', 'parking', 'parking'],
  ])('reads a type that is %s', (_name, type, expected) => {
    // Act & Assert
    expect(detailWith({ type }).type).toBe(expected);
  });

  it.each([
    ['nsc', 'nsc', 'nsc'],
    ['unknown', 'gwanggyo', 'hssc'],
    ['null', null, 'hssc'],
  ])('reads a campus that is %s', (_name, campus, expected) => {
    // Act & Assert
    expect(detailWith({ campus }).campus).toBe(expected);
  });

  it('reads a missing label or name as empty text', () => {
    // Act
    const building = detailWith({ campusLabel: null, name: null });
    const halfName = detailWith({ name: { ko: '정문' } });

    // Assert
    expect(building.campusLabel).toBe('');
    expect(building.name).toEqual({ ko: '', en: '' });
    expect(halfName.name).toEqual({ ko: '정문', en: '' });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', ''],
  ])('reads a description that is %s as none', (_name, description) => {
    // Act & Assert
    expect(detailWith({ description }).description).toBeUndefined();
  });

  it('reads a description that is not an object as empty text', () => {
    // Act & Assert
    expect(detailWith({ description: 'Main gate' }).description).toEqual({ ko: '', en: '' });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['without a url', { filename: 'a.jpg' }],
    ['with an empty url', { url: '', filename: 'a.jpg' }],
  ])('reads an image that is %s as none', (_name, image) => {
    // Act & Assert
    expect(detailWith({ image }).image).toBeUndefined();
  });

  it('reads an image without a filename', () => {
    // Act & Assert
    expect(detailWith({ image: { url: 'https://example.com/a.jpg', filename: null } }).image).toEqual({
      url: 'https://example.com/a.jpg',
      filename: '',
    });
  });

  it('reads accessibility leniently, and its absence as none', () => {
    // Act
    const partial = detailWith({ accessibility: { elevator: true, toilet: null } });
    const none = detailWith({ accessibility: null });

    // Assert
    expect(partial.accessibility).toEqual({ elevator: true, toilet: false });
    expect(none.accessibility).toBeUndefined();
  });

  it('reads absent attachments as empty', () => {
    // Act
    const building = detailWith({ attachments: null });

    // Assert
    expect(building.attachments).toEqual([]);
  });
});

describe('a building detail', () => {
  it('reads absent or null lists as empty', () => {
    // Act
    const detail = parseDetail({ building: BUILDING, floors: null });

    // Assert
    expect(detail.floors).toEqual([]);
    expect(detail.connections).toEqual([]);
  });

  it('drops a null or scalar floor, space or connection alone', () => {
    // Act
    const detail = parseDetail({
      building: BUILDING,
      floors: [null, { ...FLOOR, spaces: [7, FLOOR.spaces[0]] }, 'B1'],
      connections: [CONNECTION, false],
    });

    // Assert
    expect(detail.floors).toHaveLength(1);
    expect(detail.floors[0].spaces).toHaveLength(1);
    expect(detail.floors[0].spaces[0].spaceCd).toBe('1B401');
    expect(detail.connections).toHaveLength(1);
  });

  it('reads a floor without spaces or names leniently', () => {
    // Act
    const detail = parseDetail({
      building: BUILDING,
      floors: [{ floor: null }, { floor: { ko: '1층', en: '1F' }, spaces: [{ name: { en: 'Hall' } }] }],
    });

    // Assert
    expect(detail.floors).toEqual([
      { floor: { ko: '', en: '' }, spaces: [] },
      { floor: { ko: '1층', en: '1F' }, spaces: [{ spaceCd: '', name: { ko: '', en: 'Hall' } }] },
    ]);
  });

  it('reads a connection with null numbers leniently', () => {
    // Act
    const detail = parseDetail({
      building: BUILDING,
      connections: [{ ...CONNECTION, targetBuildNo: null, targetDisplayNo: null, fromFloor: null }],
    });

    // Assert
    expect(detail.connections[0]).toMatchObject({ targetSkkuId: 9, fromFloor: { ko: '', en: '' } });
    expect(detail.connections[0].targetBuildNo).toBeUndefined();
    expect(detail.connections[0].targetDisplayNo).toBeUndefined();
  });

  it.each([
    ['not an object', 'building'],
    ['null', null],
    ['floors that are not a list', { building: BUILDING, floors: 'B1' }],
    ['connections that are not a list', { building: BUILDING, connections: {} }],
  ])('fails a response that is %s', (_name, data) => {
    // Act & Assert
    expect(() => parseDetail(data)).toThrow();
  });
});

describe('a building search', () => {
  it('reads absent meta fields as empty', () => {
    // Act
    const result = parseSearch({ meta: {}, data: {} });

    // Assert
    expect(result).toEqual({
      keyword: '',
      buildingCount: 0,
      spaceCount: 0,
      buildings: [],
      spaces: [],
      counts: { building: { hssc: 0, nsc: 0, total: 0 }, space: { hssc: 0, nsc: 0, total: 0 } },
    });
  });

  it('reads null counts as zero and an absent total as the sum', () => {
    // Act
    const result = searchWith({
      buildingCount: null,
      counts: { building: { hssc: 2, nsc: null }, space: { hssc: 3, nsc: 4, total: null } },
    });

    // Assert
    expect(result.buildingCount).toBe(0);
    expect(result.counts).toEqual({ building: { hssc: 2, nsc: 0, total: 2 }, space: { hssc: 3, nsc: 4, total: 7 } });
  });

  it('reads counts that are not an object as zero', () => {
    // Act & Assert
    expect(searchWith({ counts: 'none' }).counts).toEqual({
      building: { hssc: 0, nsc: 0, total: 0 },
      space: { hssc: 0, nsc: 0, total: 0 },
    });
  });

  it('drops a null or scalar building or space group alone', () => {
    // Act
    const result = searchWith({}, { buildings: [null, ...buildingHit.data.buildings], spaces: [3, SPACE_GROUP] });

    // Assert
    expect(result.buildings.map((b) => b.skkuId)).toEqual([3]);
    expect(result.spaces.map((s) => s.buildNo)).toEqual(['102']);
  });

  it.each([
    ['nsc', 'nsc'],
    ['gwanggyo', null],
    [undefined, null],
  ])('reads a space group campus %s', (campus, expected) => {
    // Act & Assert
    expect(spaceGroupWith({ campus }).campus).toBe(expected);
  });

  it('reads a space group with null fields leniently', () => {
    // Act
    const group = spaceGroupWith({ skkuId: null, buildNo: null, displayNo: null, campusLabel: null, items: null });

    // Assert
    expect(group).toMatchObject({ buildNo: '', campusLabel: '', items: [] });
    expect(group.skkuId).toBeUndefined();
    expect(group.displayNo).toBeUndefined();
  });

  it.each([
    ['meta that is not an object', { meta: 'x', data: {} }],
    ['data that is null', { meta: {}, data: null }],
    ['buildings that are not a list', { meta: {}, data: { buildings: 'x' } }],
    ['spaces that are not a list', { meta: {}, data: { spaces: 1 } }],
  ])('fails a response with %s', (_name, envelope) => {
    // Act & Assert
    expect(() => parseSearch(envelope)).toThrow();
  });
});

describe('a value that is not of its type', () => {
  it('drops a search building or a connection without a readable id', () => {
    // Arrange
    const [hit] = buildingHit.data.buildings;

    // Act
    const result = searchWith({}, { buildings: [{ ...hit, _id: null }, { ...hit, _id: 'x' }, hit] });
    const detail = parseDetail({ building: BUILDING, connections: [{ ...CONNECTION, targetSkkuId: undefined }] });

    // Assert
    expect(result.buildings.map((b) => b.skkuId)).toEqual([3]);
    expect(detail.connections).toEqual([]);
  });

  it('fails a detail whose building has no readable id', () => {
    // Act & Assert
    expect(() => parseDetail({ building: { ...BUILDING, _id: undefined } })).toThrow();
    expect(() => parseDetail({})).toThrow();
  });

  it('reads a numeric-string id or count as its number', () => {
    // Act
    const building = detailWith({ _id: '2' });
    const result = searchWith({ buildingCount: '4', counts: { building: { hssc: '1', nsc: 0 } } });

    // Assert
    expect(building.skkuId).toBe(2);
    expect(result.buildingCount).toBe(4);
    expect(result.counts.building).toEqual({ hssc: 1, nsc: 0, total: 1 });
  });

  it.each([
    ['one axis', [126.99]],
    ['a null axis', [126.99, null]],
    ['a transposed pair', [37.58, 126.99]],
    ['string axes', ['126.99', '37.58']],
  ])('reads a position with %s as 0, 0', (_name, coordinates) => {
    // Act & Assert
    expect(detailWith({ location: { type: 'Point', coordinates } })).toMatchObject({ lat: 0, lng: 0 });
  });

  it('reads a field of the wrong type as its default', () => {
    // Act
    const building = detailWith({
      buildNo: 101,
      type: 7,
      campusLabel: true,
      name: { ko: 5, en: 'Hall' },
      image: { url: 'https://example.com/a.jpg', filename: 3 },
      accessibility: { elevator: 'yes', toilet: 1 },
      attachments: 'none',
    });

    // Assert
    expect(building).toMatchObject({
      type: 'building',
      campusLabel: '',
      name: { ko: '', en: 'Hall' },
      image: { url: 'https://example.com/a.jpg', filename: '' },
      accessibility: { elevator: false, toilet: false },
      attachments: [],
    });
    expect(building.buildNo).toBeUndefined();
  });

  it('drops a floor, space group or list item that is an array, or whose own list is not one', () => {
    // Act
    const detail = parseDetail({ building: BUILDING, floors: [[], { ...FLOOR, spaces: 'B4' }, FLOOR] });
    const result = searchWith({}, { spaces: [[], { ...SPACE_GROUP, items: {} }, { ...SPACE_GROUP, items: [[]] }] });

    // Assert
    expect(detail.floors).toEqual([parseDetail({ building: BUILDING, floors: [FLOOR] }).floors[0]]);
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].items).toEqual([]);
  });
});
