/**
 * A schedule config's services: which one a screen shows, the stops a run
 * passes, and the routes a day runs. The configs are skkuverse-server's
 * `GET /bus/config/:groupId` fixtures, read through the schema.
 */
import { describe, it, expect } from 'vitest';
import { parseOrThrow, type ApiEnvelope } from '@skkuverse/shared';
import { busGroupSchema } from '../bus-config.schema';
import type { BoardingStop, ScheduleEntry, ScheduleScreenConfig, SequenceStop } from '../transit.types';
import {
  decidingTime,
  resolveScheduleService,
  routesForDay,
  routeTypesForDay,
  runStops,
  splitStops,
  toRouteRows,
} from './schedule-config.rules';
import commute from '../__fixtures__/bus-config-commute-ko.json';
import campus from '../__fixtures__/bus-config-campus-ko.json';

function screenOf(envelope: unknown): ScheduleScreenConfig {
  const group = parseOrThrow(busGroupSchema, (envelope as ApiEnvelope<unknown>).data, 'bus config');
  if (group.screenType !== 'schedule') throw new Error('expected a schedule group');
  return group.screen;
}

describe('runStops and decidingTime', () => {
  const service = screenOf(commute).services.find((s) => s.serviceId === 'commute-gangnam-yangjae')!;
  const entry = (patch: Partial<ScheduleEntry>): ScheduleEntry => ({
    index: 1,
    time: '07:40',
    routeType: 'up',
    busCount: 1,
    crowding: 'unknown',
    stopTimes: ['07:40', '07:45', '08:45'],
    ...patch,
  });

  it('pairs each stop with its time', () => {
    expect(runStops(entry({}), service.stopSequences)?.map((r) => [r.stop.label, r.time])).toEqual([
      ['강남역 5번 출구', '07:40'],
      ['양재역 2번 출구', '07:45'],
      ['N센터 앞', '08:45'],
    ]);
  });

  it('gives each line its sequence stop note, never the entry notes', () => {
    const lines = runStops(entry({ notes: '양재 07:45' }), service.stopSequences);
    expect(lines?.map((r) => r.note)).toEqual(['강남역 탑승', '양재역 탑승', '자과캠 하차']);
  });

  it('leaves a line without a note empty', () => {
    const bare = {
      up: (service.stopSequences?.up ?? []).map(({ note: _note, ...stop }) => stop),
    };
    expect(runStops(entry({}), bare)?.map((r) => r.note)).toEqual([null, null, null]);
  });

  it('gives up when the lengths differ or a part is missing', () => {
    expect(runStops(entry({ stopTimes: ['07:40', '07:45'] }), service.stopSequences)).toBeNull();
    expect(runStops(entry({ stopTimes: undefined }), service.stopSequences)).toBeNull();
    expect(runStops(entry({ routeType: 'night' }), service.stopSequences)).toBeNull();
    expect(runStops(entry({}), undefined)).toBeNull();
  });

  it('decides on the last scheduled boarding stop, never an estimated one', () => {
    expect(decidingTime(entry({}), service.stopSequences)).toBe('07:45');
    expect(
      decidingTime(entry({ routeType: 'down', time: '17:00', stopTimes: ['17:00', null, '18:20'] }), service.stopSequences),
    ).toBe('17:00');
  });

  it('falls back to the entry time for a v1 row', () => {
    expect(decidingTime(entry({ stopTimes: undefined }), service.stopSequences)).toBe('07:40');
  });
});

describe('resolveScheduleService', () => {
  const services = screenOf(commute).services;
  const ids = (r: ReturnType<typeof resolveScheduleService>) => [r?.service.serviceId, r?.source];

  it('prefers a tap, then the param, the remembered, the default, the first', () => {
    const all = {
      tapped: 'commute-dogok',
      param: 'commute-jamsil',
      remembered: 'commute-gwanggyo',
      defaultId: 'commute-jeongja',
    };
    expect(ids(resolveScheduleService(services, all))).toEqual(['commute-dogok', 'tap']);
    expect(ids(resolveScheduleService(services, { ...all, tapped: null }))).toEqual([
      'commute-jamsil',
      'param',
    ]);
    expect(
      ids(resolveScheduleService(services, { remembered: 'commute-gwanggyo', defaultId: 'commute-jeongja' })),
    ).toEqual(['commute-gwanggyo', 'remembered']);
    expect(ids(resolveScheduleService(services, { defaultId: 'commute-jeongja' }))).toEqual([
      'commute-jeongja',
      'default',
    ]);
    expect(ids(resolveScheduleService(services, {}))).toEqual(['commute-jeongja', 'first']);
  });

  it('skips an id the server no longer lists', () => {
    expect(
      ids(resolveScheduleService(services, { remembered: 'commute-retired', defaultId: 'commute-dogok' })),
    ).toEqual(['commute-dogok', 'default']);
  });

  it('returns nothing for a group with no services', () => {
    expect(resolveScheduleService([], { defaultId: 'x' })).toBeUndefined();
  });
});

describe('routeTypesForDay', () => {
  const campusScreen = screenOf(campus);
  const inja = campusScreen.services[0].stopSequences;
  const run = (routeType: string): ScheduleEntry => ({ index: 1, time: '07:00', routeType, busCount: 1, crowding: 'unknown' });

  it('leaves out a route type with no run that day', () => {
    expect(routeTypesForDay(inja, campusScreen.routeBadges, [run('regular')])).toEqual(['regular']);
  });

  it('orders by the badges whatever order the runs come in', () => {
    expect(routeTypesForDay(inja, campusScreen.routeBadges, [run('hakbu'), run('regular')])).toEqual([
      'regular',
      'hakbu',
    ]);
  });

  it('shows every route type on a day with no run, rather than none', () => {
    expect(routeTypesForDay(inja, campusScreen.routeBadges, [])).toEqual(['regular', 'hakbu']);
    expect(routeTypesForDay(inja, campusScreen.routeBadges, undefined)).toEqual(['regular', 'hakbu']);
    expect(routeTypesForDay(inja, campusScreen.routeBadges, [run('night')])).toEqual(['regular', 'hakbu']);
  });

  it('puts a route type without a badge last', () => {
    const withExtra = { night: inja?.regular ?? [], ...inja };
    expect(routeTypesForDay(withExtra, campusScreen.routeBadges, undefined)).toEqual(['regular', 'hakbu', 'night']);
  });
});

describe('routesForDay', () => {
  const campusScreen = screenOf(campus);
  const badges = campusScreen.routeBadges;
  // The fixture predates server 08d12af, which gave 학부대학 the regular stops;
  // `oneRoute` is the 인자셔틀 as the server sends it since.
  const twoRoutes = campusScreen.services[0].stopSequences!;
  const oneRoute = { regular: twoRoutes.regular, hakbu: structuredClone(twoRoutes.regular) };
  const run = (routeType: string, time: string): ScheduleEntry => ({ index: 1, time, routeType, busCount: 1, crowding: 'unknown' });
  const shape = (r: ReturnType<typeof routesForDay>) => ({
    routes: r.routes.map((route) => [route.routeTypes, route.range]),
    labelled: r.labelled,
  });

  it('draws the 인자셔틀 Friday as one unnamed route, its range over both route types', () => {
    const friday = [run('hakbu', '07:50'), run('regular', '08:00'), run('regular', '18:15'), run('hakbu', '18:30')];
    const result = routesForDay(oneRoute, badges, friday);
    expect(shape(result)).toEqual({ routes: [[['regular', 'hakbu'], '07:50–18:30']], labelled: false });
    expect(result.routes[0].sequence).toBe(oneRoute.regular);
  });

  it('draws it unnamed Monday to Thursday too', () => {
    const monday = [run('regular', '07:00'), run('regular', '18:15')];
    expect(shape(routesForDay(oneRoute, badges, monday))).toEqual({
      routes: [[['regular', 'hakbu'], '07:00–18:15']],
      labelled: false,
    });
  });

  it('keeps route types whose stops differ apart, and names them', () => {
    const friday = [run('regular', '08:00'), run('hakbu', '08:20')];
    expect(shape(routesForDay(twoRoutes, badges, friday))).toEqual({
      routes: [
        [['regular'], '08:00'],
        [['hakbu'], '08:20'],
      ],
      labelled: true,
    });
    expect(shape(routesForDay(twoRoutes, badges, [run('regular', '07:00')]))).toEqual({
      routes: [[['regular'], '07:00']],
      labelled: true,
    });
  });

  it('keeps the commute shuttle per direction and named, even on a day that runs one', () => {
    const screen = screenOf(commute);
    for (const service of screen.services) {
      const both = [run('up', '07:30'), run('down', '17:00')];
      expect(shape(routesForDay(service.stopSequences, screen.routeBadges, both))).toEqual({
        routes: [
          [['up'], '07:30'],
          [['down'], '17:00'],
        ],
        labelled: true,
      });
      expect(shape(routesForDay(service.stopSequences, screen.routeBadges, [run('up', '07:30')]))).toEqual({
        routes: [[['up'], '07:30']],
        labelled: true,
      });
    }
  });

  it('draws every route without a range on a day with no run', () => {
    expect(shape(routesForDay(oneRoute, badges, undefined))).toEqual({
      routes: [[['regular', 'hakbu'], null]],
      labelled: false,
    });
    expect(routesForDay(undefined, badges, undefined)).toEqual({ routes: [], labelled: false });
  });

  it('tells stops apart by action and catalog stop, or by label and detail without one, never by note or timing', () => {
    const base = twoRoutes.regular;
    const routeTypesOf = (hakbu: typeof base) =>
      routesForDay({ regular: base, hakbu }, badges, undefined).routes.map((r) => r.routeTypes);
    const edit = (k: number, patch: Partial<(typeof base)[number]>) =>
      base.map((s, i) => (i === k ? { ...s, ...patch } : s));
    const unnamed = base.map(({ stopId: _stopId, ...s }) => s);

    expect(routeTypesOf(edit(0, { note: 'x', timing: 'estimated' }))).toEqual([['regular', 'hakbu']]);
    expect(routeTypesOf(edit(1, { action: 'board' }))).toEqual([['regular'], ['hakbu']]);
    expect(routeTypesOf(edit(1, { stopId: 'nsc-cns' }))).toEqual([['regular'], ['hakbu']]);
    expect(routeTypesOf(base.slice(0, 2))).toEqual([['regular'], ['hakbu']]);
    expect(
      routesForDay({ regular: unnamed, hakbu: unnamed.map((s) => ({ ...s })) }, badges, undefined).routes,
    ).toHaveLength(1);
    expect(
      routesForDay({ regular: unnamed, hakbu: unnamed.map((s) => ({ ...s, detail: 'A → B' })) }, badges, undefined)
        .routes,
    ).toHaveLength(2);
  });
});

describe('splitStops', () => {
  it('splits a drop-off line into its stops, ignoring stray arrows', () => {
    expect(splitStops('A → B →C')).toEqual(['A', 'B', 'C']);
    expect(splitStops('정자역 2번 출구 앞')).toEqual(['정자역 2번 출구 앞']);
    expect(splitStops(' → ')).toEqual([]);
  });
});

describe('toRouteRows: one row per stop a run passes', () => {
  const gate: BoardingStop = { id: 'gate', name: 'Main gate' };
  const catalog = new Map([['gate', gate]]);
  const roleOf = (action: SequenceStop['action']) => `role:${action}`;

  it('a stop names its catalog entry and keeps its detail', () => {
    // Arrange
    const sequence: SequenceStop[] = [{ label: 'Main gate', action: 'board', timing: 'scheduled', stopId: 'gate', detail: 'Bay 2' }];

    // Act
    const rows = toRouteRows(sequence, catalog, roleOf);

    // Assert
    expect(rows).toEqual([
      { key: '0-Main gate', name: 'Main gate', role: 'role:board', action: 'board', detail: 'Bay 2', stop: gate },
    ]);
  });

  it('an alight detail listing two or more stops becomes a row each, the stop on the first only', () => {
    // Arrange
    const sequence: SequenceStop[] = [{ label: 'Drop-off', action: 'alight', timing: 'scheduled', stopId: 'gate', detail: 'A → B' }];

    // Act
    const rows = toRouteRows(sequence, catalog, roleOf);

    // Assert
    expect(rows).toEqual([
      { key: '0-0', name: 'A', role: 'role:alight', action: 'alight', stop: gate },
      { key: '0-1', name: 'B', role: 'role:alight', action: 'alight', stop: undefined },
    ]);
  });
});
