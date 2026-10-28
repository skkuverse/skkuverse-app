/**
 * The transit schemas' named differences from the hand parsers
 * (migrate-transit-data D2): a null or scalar list item drops alone and is
 * reported under its list's name, and a `data` that is not an object fails.
 * Where the hand parser had a floor for "nothing readable", it still fires
 * when every item is dropped.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { transitLayoutSchema } from './layout.schema';
import { liveGroupSchema } from './live.schema';
import { smartScheduleSchema } from './smart-schedule.schema';
import { busGroupSchema } from './bus-config.schema';
import { subwayArrivalsSchema } from './subway/subway.schema';
import commute from './__fixtures__/bus-config-commute-ko.json';
import gangnamYangjae from './__fixtures__/smart-commute-gangnam-yangjae-ko.json';
import jongro07 from './__fixtures__/live-jongro07.json';
import hyehwa from './subway/__fixtures__/hyehwa.json';
import layoutKo from './__fixtures__/launch-ko.json';

const parseBus = (data: unknown) => parseOrThrow(busGroupSchema, data, 'GET /bus/config/:groupId');
const parseLive = (meta: unknown, data: unknown) =>
  parseOrThrow(liveGroupSchema, { meta, data }, 'GET bus live');
const parseSchedule = (data: unknown) => parseOrThrow(smartScheduleSchema, data, 'GET schedule');
const parseSubway = (data: unknown) => parseOrThrow(subwayArrivalsSchema, data, 'GET subway');
const parseLayout = (data: unknown) => parseOrThrow(transitLayoutSchema, data, 'GET /ui/home/transit');

const META = { lang: 'ko', serverNow: '2026-10-20T10:00:00+09:00' };

let drops: string[] = [];
beforeEach(() => {
  drops = [];
  setDropReporter((where) => drops.push(where));
});
afterEach(() => setDropReporter(() => {}));

const clone = <T>(value: T): T => structuredClone(value);

const realtimeConfig = (stations: unknown[]) => ({
  id: 'jongro07',
  label: '종로07',
  screenType: 'realtime',
  card: { themeColor: '4CAF50', iconType: 'bus', busTypeText: '마을' },
  screen: { liveEndpoint: '/bus/live/jongro07', refreshInterval: 20, stations, features: [] },
});
const station = (index: number) => ({ index, name: `정류장 ${index}`, transferLines: [] });

describe('a malformed transit list item drops alone', () => {
  it('keeps the two valid stations around a null one, and reports it', () => {
    // Act
    const group = parseBus(realtimeConfig([station(0), null, station(1)]));

    // Assert
    expect(group.screenType === 'realtime' && group.screen.stations.map((s) => s.index)).toStrictEqual([0, 1]);
    expect(drops).toStrictEqual(['bus.stations']);
  });

  it('drops a null transfer line of a station alone', () => {
    // Act
    const group = parseBus(realtimeConfig([{ ...station(0), transferLines: [null, { line: '4', color: '00A5DE' }] }]));

    // Assert
    expect(group.screenType === 'realtime' && group.screen.stations[0].transferLines).toStrictEqual([
      { line: '4', color: '00A5DE' },
    ]);
    expect(drops).toStrictEqual(['bus.transferLines']);
  });

  it('keeps the other services of a schedule group around a null one', () => {
    // Arrange
    const data = clone(commute.data) as { screen: { services: unknown[] } };
    const served = data.screen.services.length;
    data.screen.services.splice(1, 0, null);

    // Act
    const group = parseBus(data);

    // Assert
    expect(group.screenType === 'schedule' && group.screen.services.length).toBe(served);
    expect(drops).toStrictEqual(['bus.services']);
  });

  it('keeps the other stations and vehicles of a live line around null ones', () => {
    // Arrange
    const data = clone(jongro07.data) as { stations: unknown[]; vehicles: unknown[] };
    const stations = data.stations.length;
    const vehicles = data.vehicles.length;
    data.stations.unshift(7);
    data.vehicles.push(null);

    // Act
    const live = parseLive(META, data);

    // Assert
    expect(live.stations).toHaveLength(stations);
    expect(live.vehicles).toHaveLength(vehicles);
    expect(drops).toStrictEqual(['bus.live.vehicles', 'bus.live.stations']);
  });

  it('keeps the other days and runs of a smart schedule around null ones', () => {
    // Arrange
    const data = clone(gangnamYangjae.data) as { days: { schedule: unknown[] }[] };
    const days = data.days.length;
    const runs = data.days[0].schedule.length;
    data.days[0].schedule.push(null);
    data.days.push(null as never);

    // Act
    const schedule = parseSchedule(data);

    // Assert
    expect(schedule.days).toHaveLength(days);
    expect(schedule.days[0].schedule).toHaveLength(runs);
    expect([...drops].sort()).toStrictEqual(['bus.schedule.days', 'bus.schedule.entries']);
  });

  it('reports a null subway train, direction and line it drops', () => {
    // Arrange
    const data = clone(hyehwa.data) as { lines: { directions: { trains: unknown[] }[] }[] };
    data.lines[0].directions[0].trains.push(null);
    data.lines[0].directions.push(null as never);
    data.lines.push(null as never);

    // Act
    const arrivals = parseSubway(data);

    // Assert
    expect(arrivals).toStrictEqual(parseSubway(hyehwa.data));
    expect([...drops].sort()).toStrictEqual(['subway.directions', 'subway.lines', 'subway.trains']);
  });

  it('reports a null layout section it drops', () => {
    // Arrange
    const data = clone(layoutKo.data) as { sections: unknown[] };
    data.sections.push(null);

    // Act
    const layout = parseLayout(data);

    // Assert
    expect(layout).toStrictEqual(parseLayout(layoutKo.data));
    expect(drops).toStrictEqual(['transit.sections']);
  });
});

describe('an unusable transit envelope fails the query', () => {
  it.each([
    ['a bus config', () => parseBus('oops')],
    ['a live line', () => parseLive(META, 'oops')],
    ['a smart schedule', () => parseSchedule('oops')],
    ['subway arrivals', () => parseSubway('oops')],
    ['a transit layout', () => parseLayout('oops')],
  ])('fails %s whose data is a scalar', (_name, parse) => {
    // Assert
    expect(parse).toThrow();
  });
});

describe('every item dropped', () => {
  it('still fails subway arrivals with no readable line', () => {
    // Assert
    expect(() => parseSubway({ station: { id: 'hyehwa', name: '혜화' }, lines: [null, null] })).toThrow(/no readable line/);
  });

  it('reads a layout with every section dropped as it reads one served with none', () => {
    // Assert
    expect(parseLayout({ version: 1, sections: [null, 5] })).toStrictEqual(parseLayout({ version: 1, sections: [] }));
  });

  it('fails a schedule group whose served services all drop, so the cached config stays', () => {
    // Arrange
    const dropped = clone(commute.data) as { screen: { services: unknown[] } };
    dropped.screen.services = [null, null];

    // Assert
    expect(() => parseBus(dropped)).toThrow(/bus\.services/);
  });

  it('still reads a schedule group served with no service as empty', () => {
    // Arrange
    const empty = clone(commute.data) as { screen: { services: unknown[] } };
    empty.screen.services = [];

    // Act
    const group = parseBus(empty);

    // Assert
    expect(group.screenType === 'schedule' && group.screen.services).toStrictEqual([]);
  });

  it('fails a live line whose served stations all drop, and reads none served as empty', () => {
    // Arrange
    const dropped = clone(jongro07.data) as { stations: unknown[] };
    dropped.stations = [null, 3];
    const empty = clone(jongro07.data) as { stations: unknown[] };
    empty.stations = [];

    // Assert
    expect(() => parseLive(META, dropped)).toThrow(/bus\.live\.stations/);
    expect(parseLive(META, empty).stations).toStrictEqual([]);
  });

  it('fails a smart schedule whose served days all drop, and reads none served as empty', () => {
    // Arrange
    const dropped = clone(gangnamYangjae.data) as { days: unknown[] };
    dropped.days = [null, null];
    const empty = clone(gangnamYangjae.data) as { days: unknown[] };
    empty.days = [];

    // Assert
    expect(() => parseSchedule(dropped)).toThrow(/bus\.schedule\.days/);
    expect(parseSchedule(empty).days).toStrictEqual([]);
  });

  it('fails a smart schedule whose served runs of a day all drop, and reads none served as empty', () => {
    // Arrange
    const dropped = clone(gangnamYangjae.data) as { days: { schedule: unknown[] }[] };
    dropped.days[0].schedule = [null];
    const empty = clone(gangnamYangjae.data) as { days: { schedule: unknown[] }[] };
    empty.days[0].schedule = [];

    // Assert
    expect(() => parseSchedule(dropped)).toThrow(/bus\.schedule\.entries/);
    expect(parseSchedule(empty).days[0].schedule).toStrictEqual([]);
  });

  it.each<[string, () => unknown, RegExp]>([
    [
      'a live line whose served vehicles all have no id',
      () => parseLive(META, { ...jongro07.data, vehicles: jongro07.data.vehicles.map((vehicle) => ({ ...vehicle, id: null })) }),
      /bus\.live\.vehicles/,
    ],
    ['a live line whose served stations are all unreadable objects', () => parseLive(META, { ...jongro07.data, stations: [{}, {}] }), /bus\.live\.stations/],
    [
      'a schedule group whose served services are all unreadable objects',
      () => parseBus({ ...commute.data, screen: { ...commute.data.screen, services: [{}] } }),
      /bus\.services/,
    ],
    ['a smart schedule whose served days are all unreadable objects', () => parseSchedule({ ...gangnamYangjae.data, days: [{}] }), /bus\.schedule\.days/],
    [
      'a smart schedule whose served runs of a day are all unreadable objects',
      () => parseSchedule({ ...gangnamYangjae.data, days: [{ ...gangnamYangjae.data.days[0], schedule: [{}] }] }),
      /bus\.schedule\.entries/,
    ],
  ])('fails %s, so the cached data stays', (_name, parse, where) => {
    // Assert
    expect(parse).toThrow(where);
  });

  it('reads a realtime group with every station dropped as one served with none', () => {
    // Assert
    expect(parseBus(realtimeConfig([null, 3]))).toStrictEqual(parseBus(realtimeConfig([])));
  });
});
