/**
 * The words and times the route screen shows for what the server sent. Every
 * clock is a KST instant written with its offset, so the device's zone cannot
 * leak in, and every expected string is the product copy itself.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { campusRoutesSchema } from './campus-routes.schema';
import {
  callTimeText,
  countdownText,
  isRefetchDue,
  leaveText,
  legEmoji,
  serverNowAt,
  statusText,
  stopsSummaryText,
  toOptionView,
} from './campus-routes.rules';
import { GENERIC_LEG_EMOJI } from './emoji.constants';
import type { NotRunningOption, RouteOption } from './campus-routes.types';
import production from './__fixtures__/journey-routes.production-ko.json';
import withUpcoming from './__fixtures__/journey-routes.upcoming-stops.production-ko.json';

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

const ended = (nextServiceAt?: number): NotRunningOption => ({
  id: 'o',
  name: 'o',
  status: 'notRunning',
  reason: 'ended',
  warnings: [],
  ...(nextServiceAt === undefined ? {} : { nextServiceAt }),
});

describe('statusText', () => {
  it('names tomorrow when the next run is on the next KST day', () => {
    expect(statusText(ended(kst('2026-10-26T07:00:00')), kst('2026-10-25T22:46:00'), 'ko')).toBe(
      '운행종료 · 다음 운행 내일 07:00',
    );
  });

  it('gives a bare time when the next run is later the same KST day, past midnight', () => {
    expect(statusText(ended(kst('2026-10-26T05:18:00')), kst('2026-10-26T01:10:00'), 'ko')).toBe(
      '운행종료 · 다음 운행 05:18',
    );
  });

  it('dates a next run further away, as over a weekend', () => {
    // Saturday evening to Monday morning.
    expect(statusText(ended(kst('2026-10-26T07:00:00')), kst('2026-10-24T20:00:00'), 'ko')).toBe(
      '운행종료 · 다음 운행 10/26(월) 07:00',
    );
  });

  it('says only that service ended when the next run is unknown', () => {
    expect(statusText(ended(), kst('2026-10-25T22:46:00'), 'ko')).toBe('운행종료');
  });

  it('gives the first run of a day not started yet', () => {
    const option: NotRunningOption = { ...ended(kst('2026-10-26T05:30:00')), reason: 'notStarted' };
    expect(statusText(option, kst('2026-10-26T04:00:00'), 'ko')).toBe('운행 전 · 05:30');
  });

  it('has its own copy for an unavailable service, never 운행종료', () => {
    const option: NotRunningOption = { ...ended(), reason: 'unavailable' };
    expect(statusText(option, kst('2026-10-26T04:00:00'), 'en')).toBe('Info unavailable right now');
    expect(statusText(option, kst('2026-10-26T04:00:00'), 'ko')).toBe('정보를 불러올 수 없어요');
  });

  it('reads in English too', () => {
    expect(statusText(ended(kst('2026-10-26T07:00:00')), kst('2026-10-25T22:46:00'), 'en')).toBe(
      'Service ended · Next: tomorrow 07:00',
    );
  });

  it('draws a reason it does not know as ended', () => {
    const raw = { ...production.data.routes[0]!.options.find((o) => o.id === 'inja')!, reason: 'strike' };
    const data = parseOrThrow(campusRoutesSchema, { routes: [{ id: 'r', name: 'r', options: [raw] }] }, 'test');
    const view = toOptionView(data.routes[0]!.options[0]!, kst('2026-10-25T22:46:00'), 'ko');
    expect(view).toMatchObject({ status: 'notRunning', statusLine: '운행종료 · 다음 운행 내일 07:00' });
  });
});

describe('callTimeText', () => {
  const at = kst('2026-10-25T23:34:30');

  it('marks a headway guess as approximate', () => {
    expect(callTimeText({ isHeadwayGuess: true, isLastRun: false }, at, 'ko')).toBe('약 23:34');
    expect(callTimeText({ isHeadwayGuess: true, isLastRun: false }, at, 'en')).toBe('~23:34');
  });

  it('shows any other call as a plain time', () => {
    expect(callTimeText({ isHeadwayGuess: false, isLastRun: false }, at, 'ko')).toBe('23:34');
  });

  it('reads the KST wall clock across midnight and the UTC date line', () => {
    // 00:05 KST is 15:05 UTC the day before.
    expect(callTimeText({ isHeadwayGuess: false, isLastRun: false }, kst('2026-10-26T00:05:00'), 'ko')).toBe('00:05');
    expect(callTimeText({ isHeadwayGuess: true, isLastRun: false }, kst('2026-10-26T08:59:00'), 'ko')).toBe('약 08:59');
  });
});

describe('leaveText', () => {
  const now = kst('2026-10-25T22:00:00');

  it('counts whole minutes down, rounding down', () => {
    expect(leaveText(now + 150_000, now, 'ko')).toBe('2분 후 출발');
  });

  it('says leave now under a minute, and once the time has passed', () => {
    expect(leaveText(now + 59_000, now, 'ko')).toBe('지금 출발');
    expect(leaveText(now - 60_000, now, 'ko')).toBe('지금 출발');
  });
});

describe('toOptionView over the production answer', () => {
  const data = parseOrThrow(campusRoutesSchema, production.data, 'test');
  const options = data.routes[0]!.options;
  const now = kst('2026-10-25T22:01:18');

  function runningView(option: RouteOption) {
    const view = toOptionView(option, now, 'ko');
    if (view.status !== 'running') throw new Error('expected running');
    return view;
  }

  it('lays a trip out as its start, the rides boarded and left, the walks between, and its end', () => {
    // Act
    const view = runningView(options[0]!);

    // Assert
    expect(view.leave).toBe('1분 후 출발');
    expect(
      view.timeline.map((item) =>
        item.kind === 'ride'
          ? ['ride', item.label, item.board.name, item.alight.name]
          : item.kind === 'step'
            ? ['step', item.text]
            : [item.kind, item.place.name],
      ),
    ).toEqual([
      ['start', '정문'],
      ['step', '도보 8분'],
      ['ride', '4호선', '혜화역', '사당역'],
      ['step', '도보 2분'],
      ['ride', '7800', '사당역 9번 출구 앞', '성균관대학교'],
      ['step', '도보 15분'],
      ['end', '정문'],
    ]);
  });

  it('falls back to the planned run of a ride with no run listed now', () => {
    // Act: an answer from before the server listed runs from now.
    const [train, bus] = runningView(options[0]!).timeline.filter((item) => item.kind === 'ride');

    // Assert: a subway call derived for one train (basis estimate, with a runId) reads plain; the 7800, a headway
    // guess with no run, reads as approximate.
    expect(train).toMatchObject({ kind: 'ride', color: '00A5DE', timing: { kind: 'planned', board: { text: '22:12' } } });
    expect(bus).toMatchObject({ kind: 'ride', timing: { kind: 'planned', board: { text: '약 22:48' } } });
  });

  it('gives no stop count for a ride whose stops the server cannot list, with nothing to expand', () => {
    // Act
    const ride = runningView(options[0]!).timeline[2];

    // Assert
    expect(ride).toMatchObject({ kind: 'ride', stopsSummary: null, stops: [] });
  });

  it('marks 막차 on the planned run that is the last', () => {
    // Act
    const runs = data.routes[1]!.options
      .map((o) => toOptionView(o, now, 'ko'))
      .flatMap((v) => (v.status === 'running' ? v.timeline : []))
      .flatMap((item) => (item.kind === 'ride' && item.timing.kind === 'planned' ? [item.timing.board] : []));

    // Assert: the run boarded at 금정 on 1호선 · 4호선.
    expect(runs.filter((r) => r.isLastRun).map((r) => r.text)).toEqual(['23:03']);
  });

  it('starts and ends on the ride when the trip starts and ends with one', () => {
    // Arrange
    const option = options[0]!;
    if (option.status !== 'running') throw new Error('expected running');

    // Act
    const view = runningView({ ...option, legs: [option.legs[1]!] });

    // Assert
    expect(view.timeline.map((item) => item.kind)).toEqual(['ride']);
  });

  it('passes a warning message through as written', () => {
    // Act
    const view = toOptionView(options[2]!, now, 'ko');

    // Assert
    expect(view.warnings).toEqual(['종로5가역에서 갈아탈 차를 놓칠 수 있어요']);
  });

  it("splits the bar by every leg's minutes, a ride in its line color", () => {
    // Act
    const view = runningView(options[0]!);

    // Assert
    expect(view.bar).toEqual([
      { minutes: 8 },
      { minutes: 28, color: '00A5DE' },
      { minutes: 2 },
      expect.objectContaining({ minutes: 34 }),
      { minutes: 15 },
    ]);
  });
});

describe('toOptionView over runs counted from now', () => {
  const data = parseOrThrow(campusRoutesSchema, withUpcoming.data, 'test');
  const now = kst('2026-10-26T23:01:02');

  function ridesOf(routeIndex: number, optionId: string, at = now) {
    const option = data.routes[routeIndex]!.options.find((o) => o.id === optionId)!;
    const view = toOptionView(option, at, 'ko');
    if (view.status !== 'running') throw new Error('expected running');
    return view.timeline.flatMap((item) => (item.kind === 'ride' ? [item] : []));
  }

  it('times every ride by the nearest runs at its stop, in minutes from now', () => {
    // Act
    const [first, second] = ridesOf(0, 'line4-7800');

    // Assert: the first ride too; and the 7800 boards at a headway guess near midnight, but a tracked bus comes in 7
    // minutes.
    expect(first!.timing).toEqual({
      kind: 'upcoming',
      runs: [
        { text: '7분 후', isLastRun: false },
        { text: '13분 후', isLastRun: false },
      ],
    });
    expect(second!.timing).toEqual({ kind: 'upcoming', runs: [{ text: '7분 후', isLastRun: false }] });
  });

  it('counts a ride down as the clock moves, down to arriving', () => {
    // Act
    const [, soon] = ridesOf(0, 'line4-7800', kst('2026-10-26T23:07:40'));
    const [, passed] = ridesOf(0, 'line4-7800', kst('2026-10-26T23:09:00'));

    // Assert
    expect(soon!.timing).toEqual({ kind: 'upcoming', runs: [{ text: '곧 도착', isLastRun: false }] });
    expect(passed!.timing).toEqual({ kind: 'upcoming', runs: [{ text: '곧 도착', isLastRun: false }] });
  });

  it('times a train at the later of its arrival and its departure', () => {
    // Act: at 금정, the 4호선 is listed to arrive 23:04:54 and to leave 23:03:00.
    const [, train] = ridesOf(1, 'line1-line4');

    // Assert
    expect(train!.timing).toEqual({
      kind: 'upcoming',
      runs: [
        { text: '3분 후', isLastRun: false },
        { text: '19분 후', isLastRun: false },
      ],
    });
  });

  it('counts the stops a bus ride passes, the alight stop included, and lists the ones between', () => {
    // Act
    const [, bus] = ridesOf(0, 'line4-7800');

    // Assert
    expect(bus!.stopsSummary).toBe('9개 정류장 (33분)');
    expect(bus!.stops).toHaveLength(8);
  });
});

describe('countdownText', () => {
  const now = kst('2026-10-26T23:00:00');
  const listed = { isHeadwayGuess: false, isLastRun: false };

  it('counts whole minutes down, rounding down', () => {
    expect(countdownText(listed, now + 150_000, now, 'ko')).toBe('2분 후');
    expect(countdownText(listed, now + 150_000, now, 'en')).toBe('in 2 min');
  });

  it('says arriving under a minute and once the time has passed', () => {
    expect(countdownText(listed, now + 59_000, now, 'ko')).toBe('곧 도착');
    expect(countdownText(listed, now - 60_000, now, 'ko')).toBe('곧 도착');
  });

  it('marks a headway guess as approximate', () => {
    expect(countdownText({ isHeadwayGuess: true, isLastRun: false }, now + 300_000, now, 'ko')).toBe('약 5분 후');
  });
});

describe('stopsSummaryText', () => {
  it("counts stations for a train and stops for a bus, then the ride's minutes", () => {
    expect(stopsSummaryText(12, true, 28, 'ko')).toBe('13개 역 (28분)');
    expect(stopsSummaryText(0, false, 3, 'ko')).toBe('1개 정류장 (3분)');
    expect(stopsSummaryText(12, true, 28, 'en')).toBe('13 stops (28 min)');
  });
});

describe('legEmoji', () => {
  it('draws an icon it does not know with the generic mark', () => {
    expect(legEmoji('hovercraft')).toBe(GENERIC_LEG_EMOJI);
    expect(legEmoji('constructor')).toBe(GENERIC_LEG_EMOJI);
    expect(legEmoji('subway')).not.toBe(GENERIC_LEG_EMOJI);
  });
});

describe('serverNowAt', () => {
  it('moves the device clock by how far the server was ahead when the answer arrived', () => {
    const answer = { serverNowMs: 1_000_000 + 90_000, receivedAtMs: 1_000_000 };
    expect(serverNowAt(answer, 1_000_000 + 30_000)).toBe(1_000_000 + 120_000);
  });

  it('keeps the device clock with no server clock', () => {
    expect(serverNowAt({ receivedAtMs: 5 }, 42)).toBe(42);
    expect(serverNowAt(undefined, 42)).toBe(42);
  });
});

describe('isRefetchDue', () => {
  it('asks again on a return once the answer is older than the server max-age', () => {
    expect(isRefetchDue(1_000, 1_000 + 15_000)).toBe(true);
    expect(isRefetchDue(1_000, 1_000 + 14_999)).toBe(false);
  });

  it('never before a first answer, which the mount is already asking for', () => {
    expect(isRefetchDue(0, 1_000_000)).toBe(false);
  });
});
