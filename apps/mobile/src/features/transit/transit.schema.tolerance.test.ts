/**
 * The transit schemas' tolerance, field by field, where a zod reading could
 * differ from the hand parsers: a `null`, an empty string, a numeric string,
 * a value of the wrong type, an unknown enum member and a list that is not
 * one. Each case edits one field of a committed server fixture.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { transitLayoutSchema } from './layout.schema';
import { liveGroupSchema } from './live.schema';
import { busStopsSchema, stopArrivalsSchema } from './stops.schema';
import { smartScheduleSchema } from './smart-schedule.schema';
import { busGroupSchema } from './bus-config.schema';
import { subwayArrivalsSchema, subwayStationsSchema } from './subway/subway.schema';
import realtimeJongro07 from './__fixtures__/bus-config-realtime-jongro07.json';
import realtimeDirections from './__fixtures__/bus-config-realtime-jongro07-directions.json';
import commute from './__fixtures__/bus-config-commute-ko.json';
import gangnamYangjae from './__fixtures__/smart-commute-gangnam-yangjae-ko.json';
import liveJongro07 from './__fixtures__/live-jongro07.json';
import busStops from './__fixtures__/bus-stops-hssc-shuttle-and-poles.json';
import stopHyehwaPole from './__fixtures__/stop-arrivals-seoul-01592.json';
import stopBusLot from './__fixtures__/stop-arrivals-hssc-bus-lot.json';
import layoutKo from './__fixtures__/launch-ko.json';
import sungkyunkwan from './subway/__fixtures__/sungkyunkwan.json';
import subwayStations from './subway/__fixtures__/stations.json';

type Raw = Record<string, unknown>;
type Edit = (raw: Raw) => void;
type RawList = Raw[];

const listAt = (raw: Raw, key: string) => raw[key] as RawList;
const objectAt = (raw: Raw, key: string) => raw[key] as Raw;

function edited(fixture: { data: unknown }, edit: Edit): unknown {
  const data = structuredClone(fixture.data) as Raw;
  edit(data);
  return data;
}

const META = { lang: 'ko', serverNow: '2026-10-20T10:00:00+09:00' };

describe('a realtime bus config', () => {
  const group = (edit: Edit) => {
    const parsed = parseOrThrow(busGroupSchema, edited(realtimeJongro07, edit), 'bus config');
    if (parsed.screenType !== 'realtime') throw new Error('expected a realtime group');
    return parsed;
  };
  const screen = (edit: Edit) => group((data) => edit(objectAt(data, 'screen'))).screen;
  const station = (edit: Edit) => screen((s) => edit(listAt(s, 'stations')[0])).stations[0];
  const STATION_COUNT = realtimeJongro07.data.screen.stations.length;

  it.each<[string, Edit, (s: ReturnType<typeof station>) => unknown, unknown]>([
    ['an empty subtitle as served', (s) => (s.subtitle = ''), (s) => s.subtitle, ''],
    ['a null subtitle as none', (s) => (s.subtitle = null), (s) => 'subtitle' in s, false],
    ['an empty station number as served', (s) => (s.stationNumber = ''), (s) => s.stationNumber, ''],
    ['a null station number as none', (s) => (s.stationNumber = null), (s) => 'stationNumber' in s, false],
    ['a null first-station flag as false', (s) => (s.isFirstStation = null), (s) => s.isFirstStation, false],
    ['a missing first-station flag as false', (s) => delete s.isFirstStation, (s) => s.isFirstStation, false],
    ['a missing last-station flag as false', (s) => delete s.isLastStation, (s) => s.isLastStation, false],
    ['a null rotation flag as false', (s) => (s.isRotationStation = null), (s) => s.isRotationStation, false],
    ['a pass-through flag that is a string as false', (s) => (s.isPassThrough = 'true'), (s) => s.isPassThrough, false],
    ['an alight-only flag that is a number as false', (s) => (s.isAlightOnly = 1), (s) => s.isAlightOnly, false],
    ['an empty direction id as none', (s) => (s.directionId = ''), (s) => 'directionId' in s, false],
    ['an empty stop id as none', (s) => (s.stopId = ''), (s) => 'stopId' in s, false],
    ['a stop id that is a number as none', (s) => (s.stopId = 1617), (s) => 'stopId' in s, false],
    ['null transfer lines as none', (s) => (s.transferLines = null), (s) => s.transferLines, []],
    ['missing transfer lines as none', (s) => delete s.transferLines, (s) => s.transferLines, []],
    ['transfer lines that are not a list as none', (s) => (s.transferLines = 'none'), (s) => s.transferLines, []],
  ])('reads a station with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = station(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (s: ReturnType<typeof screen>) => unknown, unknown]>([
    ['a null refresh interval as 15 s', (s) => (s.refreshInterval = null), (s) => s.refreshInterval, 15],
    ['a missing refresh interval as 15 s', (s) => delete s.refreshInterval, (s) => s.refreshInterval, 15],
    ['a null last index as the last station', (s) => (s.lastStationIndex = null), (s) => s.lastStationIndex, STATION_COUNT - 1],
    ['a missing last index as the last station', (s) => delete s.lastStationIndex, (s) => s.lastStationIndex, STATION_COUNT - 1],
    [
      'a missing last index and no station as 0',
      (s) => {
        delete s.lastStationIndex;
        s.stations = [];
      },
      (s) => s.lastStationIndex,
      0,
    ],
    ['an empty live endpoint as none', (s) => (s.liveEndpoint = ''), (s) => 'liveEndpoint' in s, false],
    ['a null live endpoint as none', (s) => (s.liveEndpoint = null), (s) => 'liveEndpoint' in s, false],
    ['a loop flag that is a string as no loop', (s) => (s.isLoop = 'true'), (s) => s.isLoop, false],
    ['null capabilities as plates and no low floor', (s) => (s.capabilities = null), (s) => [s.hasPlates, s.hasLowFloor], [true, false]],
    [
      'capabilities that are a list as plates',
      (s) => (s.capabilities = []),
      (s) => [s.hasPlates, s.hasLowFloor],
      [true, false],
    ],
    [
      'a plate capability that is a string as plates',
      (s) => (objectAt(s, 'capabilities').plateNumber = 'false'),
      (s) => s.hasPlates,
      true,
    ],
    [
      'a low-floor capability that is a string as none',
      (s) => (objectAt(s, 'capabilities').lowFloor = 'true'),
      (s) => s.hasLowFloor,
      false,
    ],
    ['null stations as none', (s) => (s.stations = null), (s) => s.stations, []],
    ['stations that are not a list as none', (s) => (s.stations = 'none'), (s) => s.stations, []],
    ['null directions as none', (s) => (s.directions = null), (s) => s.directions, []],
    ['directions that are not a list as none', (s) => (s.directions = 'none'), (s) => s.directions, []],
    ['null features as none', (s) => (s.features = null), (s) => s.features, []],
    ['missing features as none', (s) => delete s.features, (s) => s.features, []],
    ['a null feature as dropped', (s) => (s.features = [null, { type: 'info' }]), (s) => s.features, [{ type: 'info' }]],
  ])('reads a screen with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = screen(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit]>([
    ['a range start that is a string', (d) => (d.fromIndex = '0')],
    ['a range start that is not whole', (d) => (d.fromIndex = 0.5)],
    ['a null range end', (d) => (d.toIndex = null)],
    ['an empty label', (d) => (d.label = '')],
    ['an id that is a number', (d) => (d.id = 100900043)],
  ])('drops a direction with %s alone', (_name, edit) => {
    // Act
    const parsed = parseOrThrow(
      busGroupSchema,
      edited(realtimeDirections, (data) => edit(listAt(objectAt(data, 'screen'), 'directions')[0])),
      'bus config',
    );

    // Assert
    expect(parsed.screenType === 'realtime' && parsed.screen.directions.map((d) => d.id)).toStrictEqual(['100900220']);
  });

  it.each<[string, Edit, (g: ReturnType<typeof group>) => unknown, unknown]>([
    ['an unknown screen type as realtime', (d) => (d.screenType = 'carousel'), (g) => g.screenType, 'realtime'],
    ['a missing screen type as realtime', (d) => delete d.screenType, (g) => g.screenType, 'realtime'],
    ['a null visibility as always', (d) => (d.visibility = null), (g) => g.visibility, { type: 'always' }],
    ['an unknown visibility as always', (d) => (d.visibility = { type: 'weekly' }), (g) => g.visibility, { type: 'always' }],
    [
      'a date range',
      (d) => (d.visibility = { type: 'dateRange', from: '2026-10-12', until: '2026-12-18', fromTime: '11:55' }),
      (g) => g.visibility,
      { type: 'dateRange', from: '2026-10-12', until: '2026-12-18' },
    ],
    ['an empty label as served', (d) => (d.label = ''), (g) => g.label, ''],
  ])('reads a group with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = group(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });
});

describe('a schedule bus config', () => {
  const screen = (edit: Edit) => {
    const parsed = parseOrThrow(busGroupSchema, edited(commute, (data) => edit(objectAt(data, 'screen'))), 'bus config');
    if (parsed.screenType !== 'schedule') throw new Error('expected a schedule group');
    return parsed.screen;
  };
  const stopWith = (edit: Edit) =>
    screen((s) => edit(listAt(s, 'stops').find((stop) => stop.id === 'jeongja-exit3')!)).stops.find((stop) => stop.id === 'jeongja-exit3');
  const firstService = (s: Raw) => listAt(s, 'services')[0];
  const firstSequenceStop = (s: Raw) => listAt(objectAt(firstService(s), 'stopSequences'), 'up')[0];

  it.each<[string, Edit, (s: ReturnType<typeof screen>) => unknown, unknown]>([
    ['a null default service as none', (s) => (s.defaultServiceId = null), (s) => 'defaultServiceId' in s, false],
    ['an empty default service as served', (s) => (s.defaultServiceId = ''), (s) => s.defaultServiceId, ''],
    ['null stops as none', (s) => (s.stops = null), (s) => s.stops, []],
    ['stops that are not a list as none', (s) => (s.stops = 'all'), (s) => s.stops, []],
    ['null services as none', (s) => (s.services = null), (s) => s.services, []],
    ['null route badges as none', (s) => (s.routeBadges = null), (s) => s.routeBadges, []],
    ['route badges that are not a list as none', (s) => (s.routeBadges = 'all'), (s) => s.routeBadges, []],
    [
      'a null route badge as dropped',
      (s) => listAt(s, 'routeBadges').unshift(null as never),
      (s) => s.routeBadges.map((b) => b.id),
      ['up', 'down'],
    ],
    ['a selector that is not a string as segmented', (s) => (s.serviceSelector = 1), (s) => s.serviceSelector, 'segmented'],
    [
      'a stop with an empty id as dropped',
      (s) => (listAt(s, 'stops').find((stop) => stop.id === 'jeongja-exit3')!.id = ''),
      (s) => s.stops.some((stop) => stop.name === '정자역 3번 출구'),
      false,
    ],
    [
      'a stop whose name is not a string as dropped',
      (s) => (listAt(s, 'stops').find((stop) => stop.id === 'jeongja-exit3')!.name = 3),
      (s) => s.stops.some((stop) => stop.id === 'jeongja-exit3'),
      false,
    ],
    ['null sequences as none', (s) => (firstService(s).stopSequences = null), (s) => 'stopSequences' in s.services[0], false],
    ['sequences that are a list as none', (s) => (firstService(s).stopSequences = []), (s) => 'stopSequences' in s.services[0], false],
    [
      'an empty sequence as skipped',
      (s) => (objectAt(firstService(s), 'stopSequences').up = []),
      (s) => Object.keys(s.services[0].stopSequences ?? {}),
      ['down'],
    ],
    [
      'a sequence that is not a list as skipped',
      (s) => (objectAt(firstService(s), 'stopSequences').up = 'up'),
      (s) => Object.keys(s.services[0].stopSequences ?? {}),
      ['down'],
    ],
    [
      'every sequence skipped as none',
      (s) => (firstService(s).stopSequences = { up: [], down: 'x' }),
      (s) => 'stopSequences' in s.services[0],
      false,
    ],
    [
      'a sequence stop with an empty stop id as unlinked',
      (s) => (firstSequenceStop(s).stopId = ''),
      (s) => 'stopId' in s.services[0].stopSequences!.up[0],
      false,
    ],
    [
      'a sequence stop with an empty note and detail as none',
      (s) => Object.assign(firstSequenceStop(s), { note: '', detail: '' }),
      (s) => ['note' in s.services[0].stopSequences!.up[0], 'detail' in s.services[0].stopSequences!.up[0]],
      [false, false],
    ],
    [
      'a sequence stop with an empty label as dropping its sequence',
      (s) => (firstSequenceStop(s).label = ''),
      (s) => Object.keys(s.services[0].stopSequences ?? {}),
      ['down'],
    ],
    [
      'a null sequence stop as dropping its sequence',
      (s) => listAt(objectAt(firstService(s), 'stopSequences'), 'up').push(null as never),
      (s) => Object.keys(s.services[0].stopSequences ?? {}),
      ['down'],
    ],
  ])('reads a schedule screen with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = screen(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (s: ReturnType<typeof stopWith>) => unknown, unknown]>([
    ['an empty detail as none', (s) => (s.detail = ''), (s) => s && 'detail' in s, false],
    [
      'coordinates that are strings as none, with no map',
      (s) => (s.coords = { lat: '37.36', lng: 127.1 }),
      (s) => s && ['coords' in s, 'map' in s],
      [false, false],
    ],
    ['a null map as none', (s) => (s.map = null), (s) => s && 'map' in s, false],
    ['null markers as none', (s) => (objectAt(s, 'map').markers = null), (s) => s?.map?.markers, []],
    ['markers that are not a list as none', (s) => (objectAt(s, 'map').markers = 'exit3'), (s) => s?.map?.markers, []],
    [
      'a marker with a numeric number as served',
      (s) => (listAt(objectAt(s, 'map'), 'markers')[0].number = 3),
      (s) => s?.map?.markers[0]?.number,
      3,
    ],
    [
      'a walk with a point that is a string as dropped',
      (s) => (listAt(objectAt(s, 'map'), 'paths')[0].points = ['a', 'b']),
      (s) => s?.map?.paths,
      [],
    ],
    [
      'a photo link that is not a string as none',
      (s) => (s.photoUrl = { uri: 'https://media.skkuverse.com/a.jpg' }),
      (s) => s && 'photoUrl' in s,
      false,
    ],
    ['a street view link as served', (s) => (s.streetViewUrl = 'https://naver.me/x'), (s) => s?.streetViewUrl, 'https://naver.me/x'],
  ])('reads a boarding stop with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = stopWith(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });
});

describe('a live line', () => {
  const live = (edit: Edit, meta: unknown = META) =>
    parseOrThrow(liveGroupSchema, { meta, data: edited(liveJongro07, edit) }, 'live group');
  const vehicle = (edit: Edit) => live((data) => edit(listAt(data, 'vehicles')[0])).vehicles[0];
  const position = (edit: Edit) => vehicle((v) => edit(objectAt(v, 'position'))).position;
  const arrival = (edit: Edit) => live((data) => edit(listAt(listAt(data, 'stations')[0], 'arrivals')[0])).stations[0].arrivals[0];

  it.each<[string, Edit, (v: ReturnType<typeof vehicle>) => unknown, unknown]>([
    ['an empty plate as none', (v) => (v.plateNumber = ''), (v) => v?.plateNumber, null],
    ['an occupancy that is a string as no crowding', (v) => (v.occupancy = 'relaxed'), (v) => v?.crowding, null],
    ['a null position as none', (v) => (v.position = null), (v) => v?.position, null],
    ['a position that is a list as none', (v) => (v.position = []), (v) => v?.position, null],
    ['an empty trajectory as none', (v) => (v.trajectory = []), (v) => v?.trajectory, null],
    ['a trajectory that is not a list as none', (v) => (v.trajectory = 'path'), (v) => v?.trajectory, null],
    [
      'a trajectory knot whose stop is a string as no trajectory',
      (v) => (listAt(v, 'trajectory')[1].s = '6'),
      (v) => v?.trajectory,
      null,
    ],
    ['a null trajectory knot as no trajectory', (v) => listAt(v, 'trajectory').push(null as never), (v) => v?.trajectory, null],
  ])('reads a vehicle with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = vehicle(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (p: ReturnType<typeof position>) => unknown, unknown]>([
    ['a negative station as none', (p) => (p.stationIndex = -1), (p) => p, null],
    ['a station that is a string as none', (p) => (p.stationIndex = '5'), (p) => p, null],
    ['a progress that is a string as unknown', (p) => (p.progress = '0.5'), (p) => p?.progress, null],
    ['a null section length as unknown', (p) => (p.sectionMeters = null), (p) => p?.sectionMeters, null],
    ['an unreadable next-station time as none', (p) => (p.nextStationAt = 'soon'), (p) => p?.nextStationAtMs, null],
    ['a status that is not a string as in transit', (p) => (p.status = 3), (p) => p?.status, 'inTransit'],
  ])('reads a position with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = position(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (a: ReturnType<typeof arrival>) => unknown, unknown]>([
    ['a count that is a string as unknown', (a) => (a.stopsAway = '1'), (a) => a.stopsAway, null],
    ['an empty vehicle id as none', (a) => (a.vehicleId = ''), (a) => a.vehicleId, null],
    ['a last-run flag that is a string as false', (a) => (a.isLastRun = 'true'), (a) => a.isLastRun, false],
    ['a status that is not a string as unknown', (a) => (a.status = 1), (a) => a.status, 'unknown'],
  ])('reads an arrival with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = arrival(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, unknown, (l: ReturnType<typeof live>) => unknown, unknown]>([
    ['an update time that is a number as unknown', (d) => (d.updatedAt = 1760922000000), META, (l) => l.updatedAtMs, null],
    ['null stations as none', (d) => (d.stations = null), META, (l) => l.stations, []],
    ['null vehicles as none', (d) => (d.vehicles = null), META, (l) => l.vehicles, []],
    ['null arrivals of a station as none', (d) => (listAt(d, 'stations')[0].arrivals = null), META, (l) => l.stations[0].arrivals, []],
    ['arrivals of a station that are not a list as none', (d) => (listAt(d, 'stations')[0].arrivals = 'none'), META, (l) => l.stations[0].arrivals, []],
    ['a station operation it does not know as running', (d) => (listAt(d, 'stations')[0].operation = 'paused'), META, (l) => l.stations[0].operation, 'running'],
    ['a meta that is not an object as no server clock', () => {}, null, (l) => 'serverNowMs' in l, false],
    ['a server clock that is a number as none', () => {}, { serverNow: 1760922000000 }, (l) => 'serverNowMs' in l, false],
  ])('reads a live line with %s', (_name, edit, meta, read, expected) => {
    // Act
    const parsed = live(edit, meta);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit]>([
    ['stations that are not a list', (d) => (d.stations = 'none')],
    ['vehicles that are not a list', (d) => (d.vehicles = 'none')],
  ])('fails a live line with %s', (_name, edit) => {
    // Act & Assert
    expect(() => live(edit)).toThrow();
  });
});

describe('the stop list', () => {
  const stops = (edit: (stops: RawList) => void) =>
    parseOrThrow(busStopsSchema, edited(busStops, (data) => edit(listAt(data, 'stops'))), 'bus stops');
  const pole = (all: RawList) => all.find((s) => s.id === 'seoul-01592')!;

  it.each<[string, (stops: RawList) => void, (s: ReturnType<typeof stops>) => unknown, unknown]>([
    [
      'a route whose station is a string as dropped',
      (all) => (listAt(pole(all), 'routes')[0].stationIndex = '16'),
      (s) => s.find((stop) => stop.id === 'seoul-01592')?.routes.map((r) => r.groupId),
      ['jongro08'],
    ],
    [
      'a stop without routes as dropped',
      (all) => delete pole(all).routes,
      (s) => s.some((stop) => stop.id === 'seoul-01592'),
      false,
    ],
    [
      'coordinates that are strings as none',
      (all) => (pole(all).coords = { lat: '37.58', lng: 127.0 }),
      (s) => s.find((stop) => stop.id === 'seoul-01592')?.coords,
      null,
    ],
    [
      'a towards that is not text as none',
      (all) => (listAt(pole(all), 'routes')[0].towards = '혜화동로터리'),
      (s) => s.find((stop) => stop.id === 'seoul-01592')?.routes[0],
      expect.objectContaining({ towards: null }),
    ],
  ])('reads the stop list with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = stops(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });
});

describe('a stop page', () => {
  const page = (fixture: { data: unknown }, edit: Edit, meta: unknown = META) =>
    parseOrThrow(stopArrivalsSchema, { meta, data: edited(fixture, edit) }, 'stop arrivals');
  const firstRoute = (data: Raw) => listAt(data, 'routes')[0];

  it.each<[string, { data: unknown }, Edit, (p: ReturnType<typeof page>) => unknown, unknown]>([
    ['a direction with an empty id as none', stopHyehwaPole, (d) => (firstRoute(d).direction = { id: '', label: 'x' }), (p) => p.routes[0], expect.objectContaining({ direction: null })],
    ['an empty towards as none', stopHyehwaPole, (d) => (firstRoute(d).towards = ''), (p) => p.routes[0], expect.objectContaining({ towards: null })],
    ['null vehicles as none', stopHyehwaPole, (d) => (firstRoute(d).vehicles = null), (p) => p.routes[0], expect.objectContaining({ vehicles: [] })],
    ['vehicles that are not a list as none', stopHyehwaPole, (d) => (firstRoute(d).vehicles = 'none'), (p) => p.routes[0], expect.objectContaining({ vehicles: [] })],
    ['live arrivals that are not a list as none', stopHyehwaPole, (d) => (firstRoute(d).arrivals = 'none'), (p) => p.routes[0], expect.objectContaining({ arrivals: [] })],
    ['routes that are not a list as none', stopHyehwaPole, (d) => (d.routes = 'all'), (p) => p.routes, []],
    ['stop coordinates that are null as none', stopHyehwaPole, (d) => (objectAt(d, 'stop').coords = null), (p) => p.stop.coords, null],
    [
      'a timetable operation it does not know as running',
      stopBusLot,
      (d) => (firstRoute(d).operation = 'paused'),
      (p) => p.routes[0],
      expect.objectContaining({ operation: 'running' }),
    ],
    [
      'a run without a readable departure as dropped',
      stopBusLot,
      (d) => (listAt(firstRoute(d), 'arrivals')[0].runDepartureAt = 'soon'),
      (p) => (p.routes[0].kind === 'timetable' ? p.routes[0].runs.length : null),
      2,
    ],
    [
      'null runs as none',
      stopBusLot,
      (d) => (firstRoute(d).arrivals = null),
      (p) => (p.routes[0].kind === 'timetable' ? p.routes[0].runs : null),
      [],
    ],
    [
      'timetable runs that are not a list as none',
      stopBusLot,
      (d) => (firstRoute(d).arrivals = 'none'),
      (p) => (p.routes[0].kind === 'timetable' ? p.routes[0].runs : null),
      [],
    ],
  ])('reads a stop page with %s', (_name, fixture, edit, read, expected) => {
    // Act
    const parsed = page(fixture, edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

});

describe('a smart schedule', () => {
  const schedule = (edit: Edit) => parseOrThrow(smartScheduleSchema, edited(gangnamYangjae, edit), 'smart schedule');
  const day = (edit: Edit) => schedule((data) => edit(listAt(data, 'days')[0])).days[0];
  const entry = (edit: Edit) => day((d) => edit(listAt(d, 'schedule')[0])).schedule[0];

  it.each<[string, Edit, (s: ReturnType<typeof schedule>) => unknown, unknown]>([
    ['a null origin as none', (s) => (s.from = null), (s) => 'from' in s, false],
    ['an empty origin as served', (s) => (s.from = ''), (s) => s.from, ''],
    ['a null selected date as none', (s) => (s.selectedDate = null), (s) => 'selectedDate' in s, false],
    ['a resume date and message as served', (s) => Object.assign(s, { resumeDate: '2026-11-02', message: '' }), (s) => [s.resumeDate, s.message], ['2026-11-02', '']],
    ['null days as none', (s) => (s.days = null), (s) => s.days, []],
  ])('reads a schedule with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = schedule(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (d: ReturnType<typeof day>) => unknown, unknown]>([
    ['a null label as none', (d) => (d.label = null), (d) => 'label' in d, false],
    ['an empty label as served', (d) => (d.label = ''), (d) => d.label, ''],
    ['null notices as none', (d) => (d.notices = null), (d) => d.notices, []],
    ['notices that are not a list as none', (d) => (d.notices = 'none'), (d) => d.notices, []],
    ['a null notice as dropped', (d) => listAt(d, 'notices').unshift(null as never), (d) => d.notices.length, 2],
  ])('reads a day with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = day(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit, (e: ReturnType<typeof entry>) => unknown, unknown]>([
    ['a null note as none', (e) => (e.notes = null), (e) => 'notes' in e, false],
    ['an empty note as served', (e) => (e.notes = ''), (e) => e.notes, ''],
    ['a null bus count as one bus', (e) => (e.busCount = null), (e) => e.busCount, 1],
    ['a missing bus count as one bus', (e) => delete e.busCount, (e) => e.busCount, 1],
    ['no stop times as none', (e) => (e.stopTimes = []), (e) => 'stopTimes' in e, false],
    ['null stop times as none', (e) => (e.stopTimes = null), (e) => 'stopTimes' in e, false],
    ['an eta with an empty update time as none', (e) => (e.eta = { source: 'live', updatedAt: '' }), (e) => 'eta' in e, false],
  ])('reads a run with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = entry(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit]>([
    ['days that are not a list', (s) => (s.days = 'all')],
    ['runs of a day that are not a list', (s) => (listAt(s, 'days')[0].schedule = 'none')],
  ])('fails a schedule with %s', (_name, edit) => {
    // Act & Assert
    expect(() => schedule(edit)).toThrow();
  });
});

describe('the transit layout', () => {
  const layout = (edit: (sections: RawList) => void) =>
    transitLayoutSchema.safeParse(edited(layoutKo, (data) => edit(listAt(data, 'sections'))));
  const firstItem = (sections: RawList) => listAt(sections[0], 'items')[0];

  it.each<[string, (sections: RawList) => void, unknown]>([
    ['an empty subtitle as none', (s) => (firstItem(s).subtitle = ''), expect.objectContaining({ subtitle: null })],
    [
      'an icon with an empty text as served',
      (s) => (objectAt(firstItem(s), 'icon').text = ''),
      expect.objectContaining({ icon: { type: 'shuttle', color: '003626', text: '' } }),
    ],
    [
      'an icon color that is not hex as served',
      (s) => (objectAt(firstItem(s), 'icon').color = 'green'),
      expect.objectContaining({ icon: { type: 'shuttle', color: 'green', text: '성대' } }),
    ],
    [
      'an action type spelled url as external',
      (s) => (objectAt(firstItem(s), 'action').actionType = 'url'),
      expect.objectContaining({ action: { actionType: 'external', actionValue: '/bus/schedule?groupId=campus' } }),
    ],
  ])('reads a row with %s', (_name, edit, expected) => {
    // Act
    const result = layout(edit);

    // Assert
    expect(result.success && result.data.sections[0].items[0]).toStrictEqual(expected);
  });

  it.each<[string, (sections: RawList) => void]>([
    ['an icon without text', (s) => delete objectAt(firstItem(s), 'icon').text],
    ['an empty action value', (s) => (objectAt(firstItem(s), 'action').actionValue = '')],
    ['an id that is a number', (s) => (firstItem(s).id = 1)],
  ])('drops a row with %s, and its section left empty', (_name, edit) => {
    // Act
    const result = layout(edit);

    // Assert
    expect(result.success && result.data.sections.map((s) => s.id)).toStrictEqual(['hssc', 'nsc']);
  });

  it.each<[string, unknown]>([
    ['a version that is a string', { ...layoutKo.data, version: '1' }],
    ['sections that are not a list', { ...layoutKo.data, sections: {} }],
  ])('refuses a layout with %s', (_name, data) => {
    // Act & Assert
    expect(transitLayoutSchema.safeParse(data).success).toBe(false);
  });
});

describe('subway', () => {
  const arrivals = (edit: Edit) =>
    parseOrThrow(subwayArrivalsSchema, edited(sungkyunkwan, edit), 'subway arrivals');
  const firstDirection = (data: Raw) => listAt(listAt(data, 'lines')[0], 'directions')[0];
  const firstTrain = (data: Raw) => listAt(firstDirection(data), 'trains')[0];
  const stations = (edit: Edit) => parseOrThrow(subwayStationsSchema, edited(subwayStations, edit), 'subway stations');

  it.each<[string, Edit, (a: ReturnType<typeof arrivals>) => unknown, unknown]>([
    ['a negative count as unknown', (d) => (firstTrain(d).stopsAway = -1), (a) => a.lines[0].directions[0].trains[0].stopsAway, null],
    ['an express flag that is a string as no express', (d) => (firstTrain(d).isExpress = 'true'), (a) => a.lines[0].directions[0].trains[0].isExpress, false],
    ['an empty train number as dropped', (d) => (firstTrain(d).trainNo = ''), (a) => a.lines[0].directions[0].trains, []],
    ['a next station with an empty name as none', (d) => (firstDirection(d).nextStation = { name: '' }), (a) => a.lines[0].directions[0].nextStationName, null],
    ['null trains as none', (d) => (firstDirection(d).trains = null), (a) => a.lines[0].directions[0].trains, []],
    ['trains that are not a list as none', (d) => (firstDirection(d).trains = 'none'), (a) => a.lines[0].directions[0].trains, []],
    ['station coordinates that are a list as none', (d) => (objectAt(d, 'station').coords = [37.3, 126.97]), (a) => a.coords, null],
  ])('reads arrivals with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = arrivals(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it.each<[string, Edit]>([
    ['lines that are not a list', (d) => (d.lines = 'none')],
    ['a station that is a list', (d) => (d.station = [])],
  ])('fails arrivals with %s', (_name, edit) => {
    // Act & Assert
    expect(() => arrivals(edit)).toThrow();
  });

  it.each<[string, Edit, (s: ReturnType<typeof stations>) => unknown, unknown]>([
    ['stations that are not a list as none', (d) => (d.stations = 'all'), (s) => s, []],
    ['a station with an empty title as dropped', (d) => (listAt(d, 'stations')[0].title = ''), (s) => s[0]?.id, 'hyehwa'],
    ['a station with null lines as none', (d) => (listAt(d, 'stations')[0].lines = null), (s) => s[0]?.lines, []],
    ['a station campus it does not know as none', (d) => (listAt(d, 'stations')[0].campus = 'moon'), (s) => s[0]?.campus, null],
  ])('reads stations with %s', (_name, edit, read, expected) => {
    // Act
    const parsed = stations(edit);

    // Assert
    expect(read(parsed)).toStrictEqual(expected);
  });

  it('reads a payload that is not an object as no station', () => {
    // Act & Assert
    expect(parseOrThrow(subwayStationsSchema, 'all', 'subway stations')).toStrictEqual([]);
  });
});
