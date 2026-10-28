/**
 * The stop data the line and stop sheets read (ADR 0022): `GET /bus/stops`
 * → `BusStop[]`, `GET /bus/stops/:stopId/arrivals` → `StopArrivals`, and the
 * realtime config's `directions`, `directionId`, `isAlightOnly` and `stopId`.
 *
 * The fixtures are skkuverse-server's produced contract fixtures (server
 * `38b8f9ea`, 2026-10-23): `bus-stop-list.busStopList/hssc-shuttle-and-poles`,
 * `bus-stop-arrivals.busStopArrivals/{seoul-01592,hssc-bus-lot,hssc-olympic-hall}`
 * and `bus-config.busGroup/realtime-{jongro07-directions,hssc-alight-only}`.
 * Every field asserted here was also read off the production API the same day.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { busStopsSchema, stopArrivalsSchema } from './stops.schema';
import { busGroupSchema } from './bus-config.schema';
import stopsFixture from './__fixtures__/bus-stops-hssc-shuttle-and-poles.json';
import hyehwaPole from './__fixtures__/stop-arrivals-seoul-01592.json';
import busLot from './__fixtures__/stop-arrivals-hssc-bus-lot.json';
import olympicHall from './__fixtures__/stop-arrivals-hssc-olympic-hall.json';
import jongro07Directions from './__fixtures__/bus-config-realtime-jongro07-directions.json';
import hsscAlightOnly from './__fixtures__/bus-config-realtime-hssc-alight-only.json';

const at = (iso: string) => Date.parse(iso);

type RawStop = Record<string, unknown> & { routes: Record<string, unknown>[] };
type RawList = { stops: RawStop[] };

/** The list fixture's `data` with its stops edited by `edit`. */
function stopsWith(edit: (stops: RawStop[]) => void): unknown {
  const data = structuredClone(stopsFixture.data) as RawList;
  edit(data.stops);
  return data;
}

const parseStops = (data: unknown) => parseOrThrow(busStopsSchema, data, 'GET /bus/stops');

describe('the stop list', () => {
  it('reads every stop of the server fixture in served order, with its coordinates, campus and routes', () => {
    // Act
    const stops = parseStops(stopsFixture.data);

    // Assert
    expect(stops.map((s) => s.id)).toStrictEqual([
      'hssc-hyehwa-exit1',
      'hssc-bus-lot',
      'jeongja-exit3',
      'seoul-01881',
      'seoul-01592',
    ]);
    expect(stops[4]).toStrictEqual({
      id: 'seoul-01592',
      name: { ko: '혜화역1번출구', en: '혜화역1번출구', zh: '혜화역1번출구' },
      coords: { lat: 37.5834729904, lng: 127.0017632862 },
      campus: 'hssc',
      routes: [
        {
          kind: 'live',
          groupId: 'jongro07',
          label: { ko: '종로 07', en: 'Jongro 07', zh: '钟路 07' },
          stationIndex: 16,
          towards: { ko: '혜화동로터리', en: '혜화동로터리', zh: '혜화동로터리' },
          action: 'board',
        },
        {
          kind: 'live',
          groupId: 'jongro08',
          label: { ko: '종로 08', en: 'Jongro 08', zh: '钟路 08' },
          stationIndex: 22,
          towards: { ko: '혜화동로터리', en: '혜화동로터리', zh: '혜화동로터리' },
          action: 'board',
        },
      ],
    });
  });

  it('reads a shuttle stop: no campus, null coordinates stay null, and a timetable route names its service', () => {
    // Act
    const [hyehwaExit, busLotStop, jeongja] = parseStops(stopsFixture.data);

    // Assert
    expect(hyehwaExit?.coords).toBeNull();
    expect(hyehwaExit?.campus).toBeNull();
    expect(busLotStop?.routes[0]).toStrictEqual({
      kind: 'timetable',
      groupId: 'campus',
      label: { ko: '인사캠 → 자과캠', en: 'HSSC → NSC', zh: '人文校区 → 自然校区' },
      serviceId: 'campus-inja',
      routeType: 'regular',
      action: 'board',
    });
    expect(jeongja?.routes[0]).toMatchObject({ kind: 'timetable', serviceId: 'commute-jeongja', routeType: 'up' });
  });

  it('reads a null `towards` as the line’s last station', () => {
    // Act
    const stops = parseStops(
      stopsWith((stops) => {
        stops[4]!.routes[0]!.towards = null;
      }),
    );

    // Assert
    expect(stops[4]?.routes[0]).toMatchObject({ kind: 'live', towards: null });
  });

  it('skips a route of a kind this build does not know and keeps the stop and its other routes', () => {
    // Act
    const stops = parseStops(
      stopsWith((stops) => {
        stops[4]!.routes.unshift({ kind: 'bike', groupId: 'ddareungi' });
      }),
    );

    // Assert
    expect(stops[4]?.routes.map((r) => r.groupId)).toStrictEqual(['jongro07', 'jongro08']);
  });

  it('drops a malformed route and a malformed stop alone', () => {
    // Act
    const stops = parseStops(
      stopsWith((stops) => {
        stops[4]!.routes[0] = { kind: 'live', groupId: 'jongro07' };
        stops[0] = { id: '', name: { ko: '' }, routes: [] };
      }),
    );

    // Assert
    expect(stops.map((s) => s.id)).toStrictEqual(['hssc-bus-lot', 'jeongja-exit3', 'seoul-01881', 'seoul-01592']);
    expect(stops[3]?.routes.map((r) => r.groupId)).toStrictEqual(['jongro08']);
  });

  it('reads an unknown campus as none and an unknown action as boarding', () => {
    // Act
    const stops = parseStops(
      stopsWith((stops) => {
        stops[4]!.campus = 'moon';
        stops[4]!.routes[0]!.action = 'hover';
      }),
    );

    // Assert
    expect(stops[4]?.campus).toBeNull();
    expect(stops[4]?.routes[0]?.action).toBe('board');
  });

  it('fails a payload with no stop list, so the query keeps what it had', () => {
    // Act & Assert
    expect(() => parseStops({ stops: 'none' })).toThrow('GET /bus/stops');
    expect(() => parseStops(null)).toThrow('GET /bus/stops');
  });
});

const META = { lang: 'ko', serverNow: '2026-10-20T14:10:00+09:00' };

const parsePage = (data: unknown, meta: unknown = META) =>
  parseOrThrow(stopArrivalsSchema, { meta, data }, 'GET /bus/stops/:stopId/arrivals');

type RawPage = { stop: Record<string, unknown>; routes: Record<string, unknown>[] };

/** A page fixture's `data` edited by `edit`. */
function pageWith(fixture: { data: unknown }, edit: (data: RawPage) => void): unknown {
  const data = structuredClone(fixture.data) as RawPage;
  edit(data);
  return data;
}

describe('a stop page', () => {
  it('reads the pole, its clock and each live line with its direction, arrivals and buses', () => {
    // Act
    const page = parsePage(hyehwaPole.data);

    // Assert
    expect(page.stop).toStrictEqual({
      id: 'seoul-01592',
      name: '혜화역1번출구',
      coords: { lat: 37.5834729904, lng: 127.0017632862 },
    });
    expect(page.serverNowMs).toBe(at('2026-10-20T14:10:00+09:00'));
    expect(page.routes).toHaveLength(2);
    expect(page.routes[0]).toMatchObject({
      kind: 'live',
      groupId: 'jongro07',
      label: '종로 07',
      stationIndex: 16,
      towards: '혜화동로터리',
      direction: { id: '100900220', label: '성균관대운동장 방면' },
      action: 'board',
      operation: 'running',
      updatedAtMs: at('2026-10-20T14:09:55+09:00'),
    });
    const jongro07 = page.routes[0]!;
    if (jongro07.kind !== 'live') throw new Error('expected a live entry');
    expect(jongro07.arrivals).toStrictEqual([
      {
        status: 'enRoute',
        expectedArrivalAtMs: at('2026-10-20T14:13:50+09:00'),
        stopsAway: 3,
        isLastRun: false,
        vehicleId: '100000203',
        providerText: '4분10초후[2번째 전]',
      },
    ]);
    expect(jongro07.vehicles.map((v) => v.id)).toStrictEqual(['100000203']);
    expect(page.routes[1]).toMatchObject({ kind: 'live', groupId: 'jongro08', operation: 'noData', updatedAtMs: null, arrivals: [], vehicles: [] });
  });

  it('reads a shuttle stop’s timetable entries as runs at this stop, with the day’s last run marked', () => {
    // Act
    const page = parsePage(busLot.data);

    // Assert
    expect(page.stop).toStrictEqual({ id: 'hssc-bus-lot', name: '학생회관 버스 주차장', coords: { lat: 37.587367, lng: 126.993643 } });
    expect(page.routes.map((r) => r.kind)).toStrictEqual(['timetable', 'timetable', 'live']);
    expect(page.routes[0]).toStrictEqual({
      kind: 'timetable',
      groupId: 'campus',
      label: '인사캠 → 자과캠',
      serviceId: 'campus-inja',
      routeType: 'regular',
      action: 'board',
      operation: 'running',
      runs: [
        { runDepartureAtMs: at('2026-10-20T14:30:00+09:00'), atMs: at('2026-10-20T14:30:00+09:00'), isEstimate: false, isLastRun: false },
        { runDepartureAtMs: at('2026-10-20T15:00:00+09:00'), atMs: at('2026-10-20T15:00:00+09:00'), isEstimate: false, isLastRun: false },
        { runDepartureAtMs: at('2026-10-20T15:30:00+09:00'), atMs: at('2026-10-20T15:30:00+09:00'), isEstimate: false, isLastRun: false },
      ],
    });
    expect(page.routes[1]).toMatchObject({ kind: 'timetable', routeType: 'hakbu', runs: [{ isLastRun: true }, { isLastRun: true }] });
  });

  it('reads a drop-off-only stop from its live entry’s action, never from the name', () => {
    // Act
    const page = parsePage(olympicHall.data);

    // Assert
    expect(page.stop.name).toBe('올림픽기념국민생활관');
    expect(page.routes[0]).toMatchObject({
      kind: 'live',
      groupId: 'hssc',
      action: 'alight',
      towards: '혜화동우체국',
      direction: { id: 'fromCampus', label: '하교' },
    });
  });

  it('reads a run’s time at a drop-off from its arrival fields, an estimate as one, and none as null', () => {
    // Act
    const page = parsePage(
      pageWith(busLot, (data) => {
        const entry = data.routes[0]!;
        entry.action = 'alight';
        entry.arrivals = [
          {
            status: 'scheduled',
            runDepartureAt: '2026-10-20T14:30:00+09:00',
            scheduledDepartureAt: null,
            expectedDepartureAt: null,
            scheduledArrivalAt: null,
            expectedArrivalAt: '2026-10-20T14:52:00+09:00',
            basis: 'estimate',
            isLastRun: false,
          },
          {
            status: 'scheduled',
            runDepartureAt: '2026-10-20T15:00:00+09:00',
            scheduledDepartureAt: null,
            expectedDepartureAt: null,
            scheduledArrivalAt: null,
            expectedArrivalAt: null,
            basis: 'timetable',
            isLastRun: true,
          },
        ];
      }),
    );

    // Assert
    expect(page.routes[0]).toMatchObject({
      kind: 'timetable',
      action: 'alight',
      runs: [
        { runDepartureAtMs: at('2026-10-20T14:30:00+09:00'), atMs: at('2026-10-20T14:52:00+09:00'), isEstimate: true },
        { runDepartureAtMs: at('2026-10-20T15:00:00+09:00'), atMs: null, isEstimate: false, isLastRun: true },
      ],
    });
  });

  it('reads a null direction and a null `towards` as served, and a missing clock as none', () => {
    // Act
    const page = parsePage(
      pageWith(hyehwaPole, (data) => {
        data.routes[0]!.direction = null;
        data.routes[0]!.towards = null;
      }),
      {},
    );

    // Assert
    expect(page.routes[0]).toMatchObject({ direction: null, towards: null });
    expect(page.serverNowMs).toBeUndefined();
  });

  it('skips an entry of a kind this build does not know, drops a malformed one alone, and keeps an empty list', () => {
    // Act
    const page = parsePage(
      pageWith(hyehwaPole, (data) => {
        data.routes = [{ kind: 'bike', groupId: 'ddareungi' }, { kind: 'live', groupId: 'jongro07' }, ...data.routes];
      }),
    );
    const empty = parsePage(pageWith(hyehwaPole, (data) => void (data.routes = [])));

    // Assert
    expect(page.routes.map((r) => r.groupId)).toStrictEqual(['jongro07', 'jongro08']);
    expect(empty.routes).toStrictEqual([]);
  });

  it('reads a stop without coordinates as null and an unknown operation as running', () => {
    // Act
    const page = parsePage(
      pageWith(olympicHall, (data) => {
        delete data.stop.coords;
        data.routes[0]!.operation = 'paused';
      }),
    );

    // Assert
    expect(page.stop.coords).toBeNull();
    expect(page.routes[0]?.operation).toBe('running');
  });

  it('fails a page with no stop, so the query keeps what it had', () => {
    // Act & Assert
    expect(() => parsePage({ routes: [] })).toThrow('GET /bus/stops/:stopId/arrivals');
    expect(() => parsePage(pageWith(hyehwaPole, (data) => void (data.stop = { id: 'seoul-01592' })))).toThrow(
      'GET /bus/stops/:stopId/arrivals',
    );
  });
});

const parseGroup = (data: unknown) => parseOrThrow(busGroupSchema, data, 'GET /bus/config/:groupId');

type RawGroup = { screen: Record<string, unknown> & { stations: Record<string, unknown>[] } };

function groupWith(fixture: { data: unknown }, edit: (data: RawGroup) => void): unknown {
  const data = structuredClone(fixture.data) as RawGroup;
  edit(data);
  return data;
}

describe('a realtime line’s directions and stops', () => {
  it('reads the directions and each station’s direction and stop page', () => {
    // Act
    const group = parseGroup(jongro07Directions.data);

    // Assert
    if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
    expect(group.screen.directions).toStrictEqual([
      { id: '100900043', label: '이화사거리 방면', fromIndex: 0, toIndex: 12 },
      { id: '100900220', label: '성균관대운동장 방면', fromIndex: 13, toIndex: 21 },
    ]);
    expect(group.screen.stations[0]).toMatchObject({
      index: 11,
      name: '혜화역3번출구.서울대병원입구',
      directionId: '100900043',
      stopId: 'seoul-01221',
      isAlightOnly: false,
    });
  });

  it('reads drop-off-only from the flag, and a position without a page has no stop id', () => {
    // Act
    const group = parseGroup(hsscAlightOnly.data);

    // Assert
    if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
    expect(group.screen.stations.map((s) => [s.index, s.isAlightOnly, s.stopId])).toStrictEqual([
      [3, true, 'hssc-olympic-hall'],
      [4, true, 'hssc-hyehwa-post-office'],
      [5, false, undefined],
    ]);
  });

  it('reads a server before the fields as one direction-less line that may be boarded everywhere', () => {
    // Act
    const group = parseGroup(
      groupWith(jongro07Directions, (data) => {
        delete data.screen.directions;
        for (const station of data.screen.stations) {
          delete station.directionId;
          delete station.isAlightOnly;
          delete station.stopId;
        }
      }),
    );

    // Assert
    if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
    expect(group.screen.directions).toStrictEqual([]);
    expect(group.screen.stations[0]).not.toHaveProperty('directionId');
    expect(group.screen.stations[0]).not.toHaveProperty('stopId');
    expect(group.screen.stations[0]?.isAlightOnly).toBe(false);
  });

  it('drops a malformed direction alone and keeps the stations', () => {
    // Act
    const group = parseGroup(
      groupWith(jongro07Directions, (data) => {
        data.screen.directions = [{ id: '100900043', label: '이화사거리 방면' }, ...(data.screen.directions as unknown[]).slice(1)];
      }),
    );

    // Assert
    if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
    expect(group.screen.directions.map((d) => d.id)).toStrictEqual(['100900220']);
    expect(group.screen.stations).toHaveLength(4);
  });
});
