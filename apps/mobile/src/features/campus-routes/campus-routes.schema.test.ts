/**
 * `GET /journey/routes` read through the schema the client uses: a production
 * answer whole, then each thing a later server may send that this build does
 * not know. Every case asks whether the route screen still has what it draws.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { campusRoutesMetaSchema, campusRoutesSchema } from './campus-routes.schema';
import type { CampusRoute, RouteLeg, RouteOption } from './campus-routes.types';
import production from './__fixtures__/journey-routes.production-ko.json';
import withUpcoming from './__fixtures__/journey-routes.upcoming-stops.production-ko.json';

type RawPlace = { name: string; action: unknown };
type RawLeg = Record<string, unknown> & {
  kind: string;
  icon: string;
  from: RawPlace;
  to: RawPlace;
  board?: Record<string, unknown>;
  later?: Record<string, unknown>[];
  upcoming?: Record<string, unknown>[];
};
type RawOption = Record<string, unknown> & {
  id: string;
  legs: RawLeg[];
  warnings: { code: string; message: string }[];
};
type RawRoute = Record<string, unknown> & { id: string; options: RawOption[] };

/** The fixture as the loose JSON it is; the cases below break it on purpose. */
const fixture = production as unknown as { meta: unknown; data: { routes: RawRoute[] } };

const parse = (data: unknown) => parseOrThrow(campusRoutesSchema, data, 'test');
const clone = <T>(value: T): T => structuredClone(value);
const kst = (iso: string) => Date.parse(iso);

/** The production answer's hssc-to-nsc route with its options replaced. */
function routeWith(...options: unknown[]) {
  const route = clone(fixture.data.routes[0]!);
  return { routes: [{ ...route, options }] };
}

function rawOption(id: string): RawOption {
  const found = fixture.data.routes.flatMap((r) => r.options).find((o) => o.id === id);
  if (!found) throw new Error(`no option ${id} in the fixture`);
  return clone(found);
}

function onlyRoute(data: { routes: CampusRoute[] }): CampusRoute {
  expect(data.routes).toHaveLength(1);
  return data.routes[0]!;
}

function running(option: RouteOption | undefined) {
  if (option?.status !== 'running') throw new Error('expected a running option');
  return option;
}

describe('the production answer', () => {
  const data = parse(fixture.data);
  const hssc = data.routes.find((r) => r.id === 'hssc-to-nsc')!;

  it('keeps both routes and every option, in the order sent', () => {
    expect(data.routes.map((r) => r.id)).toEqual(['hssc-to-nsc', 'nsc-to-hssc']);
    for (const [i, route] of data.routes.entries()) {
      expect(route.options.map((o) => o.id)).toEqual(fixture.data.routes[i]!.options.map((o) => o.id));
    }
  });

  it('reads a running option with its times and every leg', () => {
    const option = running(hssc.options[0]);
    expect(option).toMatchObject({
      id: 'line4-7800',
      name: '4호선 · 7800',
      leaveAt: kst('2026-10-25T22:03:11+09:00'),
      arriveAt: kst('2026-10-25T23:37:11+09:00'),
    });
    expect(option.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk', 'ride', 'walk']);
  });

  it('reads a ride with its line color and board certainty', () => {
    const ride = running(hssc.options[0]).legs[1] as Extract<RouteLeg, { kind: 'ride' }>;
    expect(ride).toMatchObject({ label: '4호선', icon: 'subway', color: '00A5DE', from: { name: '혜화역' } });
    expect(ride.from.action).toEqual({ actionType: 'route', actionValue: '/map?place=subway_station:hyehwa' });
  });

  it('reads a walk with no color', () => {
    expect(running(hssc.options[0]).legs[0]).toMatchObject({ kind: 'walk', label: '도보', icon: 'walk' });
    expect(running(hssc.options[0]).legs[0]!.color).toBeUndefined();
  });

  it('reads a not-running option with its reason and next service', () => {
    const inja = hssc.options.find((o) => o.id === 'inja');
    expect(inja).toEqual({
      id: 'inja',
      name: '인자셔틀',
      status: 'notRunning',
      reason: 'ended',
      nextServiceAt: kst('2026-10-26T07:00:00+09:00'),
      warnings: [],
    });
  });

  it('keeps a warning message as the server wrote it', () => {
    const option = hssc.options.find((o) => o.id === 'jongro08-line1')!;
    expect(option.warnings).toEqual([
      { code: 'connectionAtRisk', message: fixture.data.routes[0]!.options[2]!.warnings[0]!.message },
    ]);
  });

  it('reads the server clock from meta', () => {
    expect(campusRoutesMetaSchema.parse(fixture.meta)).toEqual({ serverNowMs: kst('2026-10-25T22:01:18+09:00') });
  });
});

describe('what a later server may send', () => {
  it('draws a leg of a kind it does not know from its base, keeping the trip whole', () => {
    const raw = rawOption('line4-7800');
    raw.legs[2] = { ...raw.legs[2]!, kind: 'taxi', icon: 'taxi', color: 'FFCC00' };

    const option = running(onlyRoute(parse(routeWith(raw))).options[0]);

    expect(option.legs).toHaveLength(5);
    expect(option.legs[2]).toMatchObject({ kind: 'other', icon: 'taxi', color: 'FFCC00', to: { name: '사당역 9번 출구 앞' } });
  });

  it('drops alone an option with a leg it cannot read, keeping the others', () => {
    const broken = rawOption('line4-7800');
    broken.legs[1]!.startAt = 'not a time';

    const route = onlyRoute(parse(routeWith(broken, rawOption('inja'))));

    expect(route.options.map((o) => o.id)).toEqual(['inja']);
  });

  it('drops alone a running option with no legs or no leave time', () => {
    const noLegs = { ...rawOption('line4-7800'), legs: [] };
    const noLeave = { ...rawOption('line4-7800'), leaveAt: null };

    const route = onlyRoute(parse(routeWith(noLegs, noLeave, rawOption('inja'))));

    expect(route.options.map((o) => o.id)).toEqual(['inja']);
  });

  it('skips an option whose status it does not know', () => {
    const route = onlyRoute(parse(routeWith({ ...rawOption('inja'), status: 'delayed' }, rawOption('inja'))));
    expect(route.options).toHaveLength(1);
  });

  it('reads unavailable, which never carries a next service, as its own reason', () => {
    const raw = { ...rawOption('inja'), reason: 'unavailable', nextServiceAt: null };
    expect(onlyRoute(parse(routeWith(raw))).options[0]).toEqual({
      id: 'inja',
      name: '인자셔틀',
      status: 'notRunning',
      reason: 'unavailable',
      warnings: [],
    });
  });

  it('reads a reason it does not know as ended', () => {
    const route = onlyRoute(parse(routeWith({ ...rawOption('inja'), reason: 'strike' })));
    expect(route.options[0]).toMatchObject({ status: 'notRunning', reason: 'ended' });
  });

  it('keeps a warning of a code it does not know, with its message', () => {
    const raw = { ...rawOption('inja'), warnings: [{ code: 'roadworks', message: '공사로 우회해요' }] };
    expect(onlyRoute(parse(routeWith(raw))).options[0]!.warnings).toEqual([{ code: 'roadworks', message: '공사로 우회해요' }]);
  });

  it('keeps an icon it does not know, for the screen to draw generically', () => {
    const raw = rawOption('line4-7800');
    raw.legs[3]!.icon = 'hovercraft';
    expect(running(onlyRoute(parse(routeWith(raw))).options[0]).legs[3]!.icon).toBe('hovercraft');
  });

  it('reads a null action, or one of a type it does not know, as an untappable place', () => {
    const raw = rawOption('line4-7800');
    raw.legs[0]!.to.action = null;
    raw.legs[1]!.from.action = { actionType: 'teleport', actionValue: '/x' };

    const legs = running(onlyRoute(parse(routeWith(raw))).options[0]).legs;

    expect(legs[0]!.to).toEqual({ name: '혜화역' });
    expect(legs[1]!.from).toEqual({ name: '혜화역' });
  });

  it('reads a call with neither a run nor a vehicle as a headway guess, and a subway estimate with a run as none', () => {
    const raw = rawOption('line4-7800');
    const legs = running(onlyRoute(parse(routeWith(raw))).options[0]).legs as Extract<RouteLeg, { kind: 'ride' }>[];

    expect(legs[1]!.board).toEqual({ isHeadwayGuess: false, isLastRun: false });
    expect(legs[3]!.board).toEqual({ isHeadwayGuess: true, isLastRun: false });
  });

  it('does not read a predicted bus, a tracked vehicle with no run, as a headway guess', () => {
    const raw = rawOption('line4-7800');
    raw.legs[3]!.board!.vehicleId = '200011140';

    const legs = running(onlyRoute(parse(routeWith(raw))).options[0]).legs as Extract<RouteLeg, { kind: 'ride' }>[];

    expect(legs[3]!.board).toEqual({ isHeadwayGuess: false, isLastRun: false });
  });

  it('reads isLastRun on a board call and on an upcoming call, and anything but true as not last', () => {
    const raw = rawOption('line4-7800');
    const ride = raw.legs[1]!;
    ride.upcoming = clone(ride.later!);
    ride.board!.isLastRun = true;
    ride.upcoming[1]!.isLastRun = true;
    ride.upcoming[0]!.isLastRun = 'yes';

    const leg = running(onlyRoute(parse(routeWith(raw))).options[0]).legs[1] as Extract<RouteLeg, { kind: 'ride' }>;

    expect(leg.board.isLastRun).toBe(true);
    expect(leg.upcoming.map((c) => c.isLastRun)).toEqual([false, true]);
  });

  it('keeps the last run of the production answer', () => {
    const nsc = parse(fixture.data).routes.find((r) => r.id === 'nsc-to-hssc')!;
    const rides = nsc.options.flatMap((o) => (o.status === 'running' ? o.legs : [])).filter((l) => l.kind === 'ride');
    const lastBoards = rides.filter((l) => l.board.isLastRun);
    expect(lastBoards.length).toBeGreaterThan(0);
  });

  it('drops an upcoming call with no time', () => {
    const raw = rawOption('line4-7800');
    const ride = raw.legs[1]!;
    ride.upcoming = clone(ride.later!);
    ride.upcoming[0] = {
      ...ride.upcoming[0],
      expectedArrivalAt: null,
      expectedDepartureAt: null,
      scheduledArrivalAt: null,
      scheduledDepartureAt: null,
    };

    const leg = running(onlyRoute(parse(routeWith(raw))).options[0]).legs[1] as Extract<RouteLeg, { kind: 'ride' }>;

    expect(leg.upcoming).toHaveLength(ride.upcoming.length - 1);
  });

  it('boards an upcoming run at its expected arrival when that is after its listed departure', () => {
    const raw = rawOption('line4-7800');
    const ride = raw.legs[1]!;
    ride.upcoming = [
      {
        ...ride.later![0],
        expectedDepartureAt: null,
        scheduledDepartureAt: '2026-10-25T22:20:00+09:00',
        expectedArrivalAt: '2026-10-25T22:21:40+09:00',
        scheduledArrivalAt: null,
      },
    ];

    const leg = running(onlyRoute(parse(routeWith(raw))).options[0]).legs[1] as Extract<RouteLeg, { kind: 'ride' }>;

    expect(leg.upcoming[0]!.at).toBe(kst('2026-10-25T22:21:40+09:00'));
  });

  it('drops a route it cannot read and keeps the other', () => {
    const data = clone(fixture.data);
    data.routes[0]!.name = null;
    expect(parse(data).routes.map((r) => r.id)).toEqual(['nsc-to-hssc']);
  });

  it('fails an answer with no routes list, so the query fails', () => {
    expect(() => parse({})).toThrow();
    expect(() => parse({ routes: 'none' })).toThrow();
  });

  it('reads meta with no readable clock as no clock', () => {
    expect(campusRoutesMetaSchema.parse({ lang: 'ko' })).toEqual({});
    expect(campusRoutesMetaSchema.parse(null)).toEqual({});
  });
});

describe('the upcoming runs and the stops between', () => {
  const live = withUpcoming as unknown as { data: { routes: RawRoute[] } };
  const rides = (data: { routes: CampusRoute[] }) =>
    data.routes
      .flatMap((r) => r.options)
      .flatMap((o) => (o.status === 'running' ? o.legs : []))
      .filter((l) => l.kind === 'ride');

  it("reads the runs counted from now and a bus ride's stops from the production answer", () => {
    // Arrange
    const data = parse(live.data);

    // Act
    const [subway, bus] = rides(data);

    // Assert
    expect(subway).toMatchObject({ label: '4호선', isRail: true, stops: null });
    expect(subway!.upcoming.map((c) => c.at)).toEqual([kst('2026-10-26T23:08:30+09:00'), kst('2026-10-26T23:14:30+09:00')]);
    expect(bus).toMatchObject({ label: '7800', isRail: false });
    expect(bus!.upcoming).toEqual([{ at: kst('2026-10-26T23:08:02+09:00'), isHeadwayGuess: false, isLastRun: false }]);
    expect(bus!.stops!.map((p) => p.name)).toEqual([
      '과천동행정복지센터',
      '의왕톨게이트',
      '동원고교.해우재입구',
      '백선교회',
      '수원고용노동청',
      '성균관대역',
      '성균관대학교',
      '삼성아파트',
    ]);
    expect(bus!.stops![0]!.action).toBeUndefined();
  });

  it('reads a ride from a server that predates them as no runs and unknown stops', () => {
    // Act
    const [ride] = rides(parse(fixture.data));

    // Assert
    expect(ride).toMatchObject({ upcoming: [], stops: null });
  });

  it('reads the stops as unknown when one cannot be read, rather than miscounting the ride', () => {
    // Arrange
    const raw = clone(live.data.routes[0]!.options[0]!);
    const stops = raw.legs[3]!.stops as { place: { name: unknown } }[];
    stops[1]!.place.name = null;

    // Act
    const leg = running(onlyRoute(parse(routeWith(raw))).options[0]).legs[3] as Extract<RouteLeg, { kind: 'ride' }>;

    // Assert
    expect(leg.stops).toBeNull();
  });

  it('keeps an empty stop list, a ride with nothing between', () => {
    // Arrange
    const raw = clone(live.data.routes[0]!.options[0]!);
    raw.legs[3]!.stops = [];

    // Act
    const leg = running(onlyRoute(parse(routeWith(raw))).options[0]).legs[3] as Extract<RouteLeg, { kind: 'ride' }>;

    // Assert
    expect(leg.stops).toEqual([]);
  });
});
