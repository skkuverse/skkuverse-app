/**
 * `GET /bus/live/:groupId` → `LiveGroup`, and the realtime config fields that
 * go with it.
 *
 * The `live-*.json` and `bus-config-realtime-*.json` fixtures are
 * skkuverse-server's produced contract fixtures
 * (`contracts/produced/fixtures/bus-live.liveGroup/` and
 * `bus-config.busGroup/realtime-*-stop-ids.json`, server `e6fd6c27`).
 */
import { describe, it, expect } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { liveGroupSchema } from './live.schema';
import { busGroupSchema } from './bus-config.schema';
import jongro07 from './__fixtures__/live-jongro07.json';
import hsscRunning from './__fixtures__/live-hssc-running.json';
import hsscLayover from './__fixtures__/live-hssc-layover.json';
import hsscNoData from './__fixtures__/live-hssc-no-data.json';
import configHssc from './__fixtures__/bus-config-realtime-hssc.json';
import configJongro07 from './__fixtures__/bus-config-realtime-jongro07.json';

const META = { lang: 'ko', serverNow: '2026-10-20T10:00:00+09:00' };
const at = (time: string) => Date.parse(`2026-10-20T${time}+09:00`);

const parse = (data: unknown, meta: unknown = META) =>
  parseOrThrow(liveGroupSchema, { meta, data }, 'GET bus live');

/** jongro07 with its stations replaced by one holding `arrival`. */
const withArrival = (arrival: Record<string, unknown>) =>
  parse({ ...jongro07.data, stations: [{ stationIndex: 3, operation: 'running', arrivals: [arrival] }] }).stations[0]!
    .arrivals[0];

/** jongro07 with its vehicles replaced by `vehicle`. */
const withVehicle = (vehicle: Record<string, unknown>) => parse({ ...jongro07.data, vehicles: [vehicle] }).vehicles;

const VEHICLE = jongro07.data.vehicles[0]!;

describe('a live Jongno line', () => {
  it('reads every field of the server fixture', () => {
    // Act
    const live = parse(jongro07.data);

    // Assert
    expect(live.groupId).toBe('jongro07');
    expect(live.updatedAtMs).toBe(Date.parse(jongro07.data.updatedAt));
    expect(live.operation).toBe('running');
    expect(live.serverNowMs).toBe(at('10:00:00'));
    expect(live.vehicles[0]).toStrictEqual({
      id: '100000103',
      plateNumber: '서울74사5537',
      crowding: 'relaxed',
      isLowFloor: null,
      position: {
        stationIndex: 5,
        status: 'inTransit',
        progress: 0.5,
        sectionMeters: VEHICLE.position.sectionMeters,
        nextStationAtMs: null,
        positionAtMs: at('09:59:30'),
        checkedAtMs: at('10:00:00'),
      },
      trajectory: [
        { atMs: at('09:59:30'), s: 5.5 },
        { atMs: at('10:00:08'), s: 6 },
      ],
    });
    expect(live.stations[0]).toStrictEqual({
      stationIndex: 0,
      operation: 'running',
      arrivals: [
        {
          status: 'enRoute',
          expectedArrivalAtMs: at('10:02:00'),
          stopsAway: 1,
          isLastRun: false,
          vehicleId: '100000103',
          providerText: '3분후[1번째 전]',
        },
        {
          status: 'waitingToDepart',
          expectedArrivalAtMs: null,
          stopsAway: null,
          isLastRun: false,
          vehicleId: null,
          providerText: '출발대기',
        },
      ],
    });
  });
});

describe('a live HSSC line', () => {
  it('reads a bus with no plate, occupancy or text, aged by its check and not its stop event', () => {
    // Act
    const [moving, standing] = parse(hsscRunning.data).vehicles;

    // Assert
    expect(moving).toMatchObject({ id: '32149', plateNumber: null, crowding: null });
    expect(moving!.position).toMatchObject({ positionAtMs: at('09:59:50'), checkedAtMs: at('09:59:55') });
    expect(standing!.position?.status).toBe('atStop');
  });

  it('reads the layover: a bus waiting at 농구장 with no path, and the stops it serves next', () => {
    // Act
    const live = parse(hsscLayover.data);

    // Assert
    expect(live.vehicles[0]).toMatchObject({ id: '32150', trajectory: null });
    expect(live.vehicles[0]!.position?.status).toBe('waitingToDepart');
    expect(live.stations[0]!.arrivals.map((a) => a.status)).toStrictEqual(['waitingToDepart', 'enRoute']);
  });

  it('reads a path that runs past the last station, back to 농구장', () => {
    expect(parse(hsscLayover.data).vehicles[1]!.trajectory?.at(-1)?.s).toBe(11);
  });

  it('reads no bus overnight as no vehicles and no stations', () => {
    // Act
    const live = parse(hsscNoData.data);

    // Assert
    expect(live).toMatchObject({ operation: 'noData', vehicles: [], stations: [] });
  });
});

describe('open enums read as the server reference names', () => {
  it('reads an arrival status this build does not know as unknown, keeping its text', () => {
    expect(withArrival({ status: 'teleporting', providerText: '곧 도착' })).toMatchObject({
      status: 'unknown',
      providerText: '곧 도착',
    });
  });

  it('reads a bus standing at the station, from a server that still sends atStop, as arriving', () => {
    expect(withArrival({ status: 'atStop', stopsAway: 0, expectedDepartureAt: '2026-10-20T10:02:00+09:00' })).toMatchObject({
      status: 'arriving',
      stopsAway: 0,
    });
  });

  it('reads an operation this build does not know as running', () => {
    expect(parse({ ...jongro07.data, operation: 'paused' }).operation).toBe('running');
  });

  it('reads a position status this build does not know as in transit', () => {
    expect(withVehicle({ ...VEHICLE, position: { ...VEHICLE.position, status: 'hovering' } })[0]!.position?.status).toBe(
      'inTransit',
    );
  });

  it('reads whether a bus is low-floor, and anything but a boolean as unknown (a server before the field)', () => {
    expect(withVehicle({ ...VEHICLE, isLowFloor: true })[0]!.isLowFloor).toBe(true);
    expect(withVehicle({ ...VEHICLE, isLowFloor: false })[0]!.isLowFloor).toBe(false);
    expect(withVehicle({ ...VEHICLE, isLowFloor: 'yes' })[0]!.isLowFloor).toBeNull();
    expect(withVehicle(VEHICLE)[0]!.isLowFloor).toBeNull();
  });

  it('reads an occupancy level this build does not know as none', () => {
    expect(withVehicle({ ...VEHICLE, occupancy: { level: 'packed', passengerCount: 80 } })[0]!.crowding).toBeNull();
  });
});

describe('one station or vehicle that cannot be read is skipped alone', () => {
  it('skips a station without an index, keeping the others', () => {
    // Arrange
    const stations = [{ ...jongro07.data.stations[0], stationIndex: 'x' }, jongro07.data.stations[1]];

    // Act
    const live = parse({ ...jongro07.data, stations });

    // Assert
    expect(live.stations.map((s) => s.stationIndex)).toStrictEqual([1]);
  });

  it('skips a vehicle without an id', () => {
    expect(parse({ ...jongro07.data, vehicles: [{ ...VEHICLE, id: null }, VEHICLE] }).vehicles.map((v) => v.id)).toStrictEqual([VEHICLE.id]);
  });

  it('keeps a vehicle whose position cannot be aged, with no position', () => {
    expect(withVehicle({ ...VEHICLE, position: { ...VEHICLE.position, checkedAt: 'later' } })[0]!.position).toBeNull();
  });

  it('drops a whole path when a knot is unreadable or out of order, keeping the bus', () => {
    // Arrange
    const outOfOrder = [
      { at: '2026-10-20T10:00:08+09:00', s: 6 },
      { at: '2026-10-20T09:59:30+09:00', s: 5.5 },
    ];

    // Act
    const [unreadable] = withVehicle({ ...VEHICLE, trajectory: [{ at: 'soon', s: 6 }] });
    const [backward] = withVehicle({ ...VEHICLE, trajectory: outOfOrder });

    // Assert
    expect(unreadable!.trajectory).toBeNull();
    expect(backward!.trajectory).toBeNull();
    expect(backward!.position).not.toBeNull();
  });

  it('reads unreadable instants and numbers as unknown', () => {
    expect(withArrival({ status: 'enRoute', expectedArrivalAt: 'soon', stopsAway: 1.5, providerText: '' })).toStrictEqual({
      status: 'enRoute',
      expectedArrivalAtMs: null,
      stopsAway: null,
      isLastRun: false,
      vehicleId: null,
      providerText: null,
    });
  });

  it('reads a group with nothing cached (its poller stopped) apart from one with no bus', () => {
    expect(parse({ ...jongro07.data, updatedAt: null, vehicles: [], stations: [] }).updatedAtMs).toBeNull();
  });

  it('reads no server clock from an answer without one', () => {
    expect(parse(jongro07.data, {}).serverNowMs).toBeUndefined();
  });
});

describe('the realtime config fields of the live route', () => {
  it('reads a station the line passes without stopping, and reads one a server does not mark as a stop', () => {
    // Arrange: HSSC's two 혜화동로터리 passes, as the server marks them
    const data = structuredClone(configHssc.data) as { screen: { stations: Record<string, unknown>[] } };
    data.screen.stations[1] = { ...data.screen.stations[1], isPassThrough: true };

    // Act
    const group = parseOrThrow(busGroupSchema, data, 'GET /bus/config/hssc');

    // Assert
    expect(group.screenType === 'realtime' && group.screen.stations.map((s) => s.isPassThrough)).toStrictEqual(
      data.screen.stations.map((_, i) => i === 1),
    );
  });


  it('reads the HSSC line as a loop whose source names no plate', () => {
    // Act
    const group = parseOrThrow(busGroupSchema, configHssc.data, 'GET /bus/config/hssc');

    // Assert
    expect(group.screenType === 'realtime' && group.screen).toMatchObject({
      liveEndpoint: '/bus/live/hssc',
      isLoop: true,
      hasPlates: false,
    });
  });

  it('reads whether a line can name a low-floor bus only from a served true', () => {
    // Arrange
    const served = structuredClone(configJongro07.data) as { screen: { capabilities: Record<string, unknown> } };
    served.screen.capabilities.lowFloor = true;

    // Act
    const known = parseOrThrow(busGroupSchema, served, 'GET /bus/config/jongro07');
    const before = parseOrThrow(busGroupSchema, configJongro07.data, 'GET /bus/config/jongro07');

    // Assert
    expect(known.screenType === 'realtime' && known.screen.hasLowFloor).toBe(true);
    expect(before.screenType === 'realtime' && before.screen.hasLowFloor).toBe(false);
  });

  it('reads a Jongno route as a line with plates', () => {
    // Act
    const group = parseOrThrow(busGroupSchema, configJongro07.data, 'GET /bus/config/jongro07');

    // Assert
    expect(group.screenType === 'realtime' && group.screen).toMatchObject({
      liveEndpoint: '/bus/live/jongro07',
      isLoop: false,
      hasPlates: true,
    });
  });
});
