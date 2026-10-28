/**
 * What the realtime screen shows from a live line's arrivals, counted down at
 * the server's clock.
 */

import { describe, expect, it } from 'vitest';
import { arrivalLines, formatArrivalText, isServiceOver, lowFloorVehicleIds, stationLine, type ArrivalText } from './arrival.rules';
import { parseOrThrow, t, tpl } from '@skkuverse/shared';
import { liveGroupSchema } from './live.schema';
import hsscLayover from './__fixtures__/live-hssc-layover.json';
import type { LiveArrival, LiveGroup, LiveOperation, LiveStation, LiveVehicle } from './transit.types';

const NOW = Date.parse('2026-10-20T10:00:00+09:00');
const inSec = (seconds: number) => NOW + seconds * 1000;

function arrival(fields: Partial<LiveArrival>): LiveArrival {
  return {
    status: 'unknown',
    expectedArrivalAtMs: null,
    stopsAway: null,
    isLastRun: false,
    vehicleId: null,
    providerText: null,
    ...fields,
  };
}

function stop(stationIndex: number, ...arrivals: LiveArrival[]): LiveStation {
  return { stationIndex, operation: 'running', arrivals };
}

function line(
  stations: LiveStation[],
  operation: LiveOperation = 'running',
): Pick<LiveGroup, 'operation' | 'stations'> {
  return { operation, stations };
}

const enRoute = (seconds: number, fields: Partial<LiveArrival> = {}) =>
  arrival({ status: 'enRoute', expectedArrivalAtMs: inSec(seconds), ...fields });

const textAt = (a: LiveArrival) => arrivalLines(line([stop(3, a)]), NOW).get(3)?.text;

describe('arrivalLines counts a bus down from its instant', () => {
  it('shows the minutes left, rounded, and the stops away', () => {
    expect(textAt(enRoute(3 * 60 + 36, { stopsAway: 2 }))).toStrictEqual({ kind: 'minutes', minutes: 4, stopsAway: 2 });
  });

  it('never shows fewer than one minute while counting', () => {
    expect(textAt(enRoute(61))).toStrictEqual({ kind: 'minutes', minutes: 1, stopsAway: null });
  });

  it('reads the instant at the server clock it is given, so the count moves between polls', () => {
    // Arrange
    const a = enRoute(5 * 60);

    // Act
    const later = arrivalLines(line([stop(3, a)]), NOW + 3 * 60_000).get(3)?.text;

    // Assert
    expect(later).toStrictEqual({ kind: 'minutes', minutes: 2, stopsAway: null });
  });

  it('shows 곧 도착 from a minute out, and while overdue by up to two minutes', () => {
    expect(textAt(enRoute(60))).toStrictEqual({ kind: 'arriving' });
    expect(textAt(enRoute(-120))).toStrictEqual({ kind: 'arriving' });
  });

  it('drops an arrival overdue by more than two minutes until a poll replaces it', () => {
    expect(textAt(enRoute(-121))).toBeUndefined();
  });

  it('shows 곧 도착 when the source says so, whatever its time', () => {
    expect(textAt(arrival({ status: 'arriving', expectedArrivalAtMs: inSec(300) }))).toStrictEqual({ kind: 'arriving' });
    expect(textAt(arrival({ status: 'arriving' }))).toStrictEqual({ kind: 'arriving' });
  });

  it('drops the stops count when it is missing or zero', () => {
    expect(textAt(enRoute(300, { stopsAway: 0 }))).toStrictEqual({ kind: 'minutes', minutes: 5, stopsAway: null });
  });

  it('shows the source text for a bus on its way with no time', () => {
    expect(textAt(arrival({ status: 'enRoute', providerText: '3분후[1번째 전]' }))).toStrictEqual({
      kind: 'message',
      text: '3분후[1번째 전]',
    });
  });
});

describe('arrivalLines by status', () => {
  it('shows a bus standing at the stop as arriving until it departs, with no departure time', () => {
    expect(textAt(arrival({ status: 'arriving', stopsAway: 0 }))).toStrictEqual({ kind: 'arriving' });
  });

  it('never counts down a bus that must still leave its origin or turnaround', () => {
    expect(textAt(arrival({ status: 'waitingToDepart', stopsAway: 3, providerText: '출발대기' }))).toStrictEqual({
      kind: 'waiting',
    });
  });

  it('shows the source text for a status this build does not know, and nothing without one', () => {
    expect(textAt(arrival({ status: 'unknown', providerText: '회차지 도착' }))).toStrictEqual({
      kind: 'message',
      text: '회차지 도착',
    });
    expect(textAt(arrival({ status: 'unknown' }))).toBeUndefined();
  });

  it('marks the last bus', () => {
    expect(arrivalLines(line([stop(3, enRoute(300, { isLastRun: true }))]), NOW).get(3)?.isLastRun).toBe(true);
  });
});

describe('arrivalLines shows one bus per stop', () => {
  it('shows a bus pulling in over a waiting bus TOPIS listed first (jongro02, 2026-10-18)', () => {
    // Act
    const lines = arrivalLines(
      line([
        stop(12, arrival({ status: 'waitingToDepart', stopsAway: 11 }), arrival({ status: 'arriving', stopsAway: 0 })),
        stop(16, arrival({ status: 'waitingToDepart', stopsAway: 15 }), enRoute(410, { stopsAway: 4, isLastRun: true })),
      ]),
      NOW,
    );

    // Assert
    expect(lines.get(12)).toStrictEqual({ text: { kind: 'arriving' }, isLastRun: false });
    expect(lines.get(16)).toStrictEqual({
      text: { kind: 'minutes', minutes: 7, stopsAway: 4 },
      isLastRun: true,
    });
  });

  it('shows the bus laying over at 농구장 ahead of the one arriving to lay over after it (HSSC)', () => {
    // Arrange
    const live = parseOrThrow(liveGroupSchema, { meta: {}, data: hsscLayover.data }, 'GET bus live');

    // Act
    const lines = arrivalLines(live, Date.parse('2026-10-20T10:00:00+09:00'));

    // Assert
    expect(lines.get(0)?.text).toStrictEqual({ kind: 'waiting' });
  });

  it('shows the first bus when none is on its way', () => {
    expect(textAt(arrival({ status: 'waitingToDepart' }))).toStrictEqual({ kind: 'waiting' });
  });

  it('passes over a long-overdue bus to the next one', () => {
    // Act
    const lines = arrivalLines(line([stop(3, enRoute(-300), enRoute(420))]), NOW);

    // Assert
    expect(lines.get(3)?.text).toStrictEqual({ kind: 'minutes', minutes: 7, stopsAway: null });
  });

  it('shows nothing for a stop the source states nothing for', () => {
    expect(arrivalLines(line([stop(3)]), NOW).has(3)).toBe(false);
  });
});

describe('the line and station operation', () => {
  it('says a station is done, or has no data, in place of its arrivals', () => {
    // Act
    const lines = arrivalLines(
      line([
        { stationIndex: 1, operation: 'ended', arrivals: [arrival({ providerText: '운행종료' })] },
        { stationIndex: 2, operation: 'noData', arrivals: [] },
      ]),
      NOW,
    );

    // Assert
    expect(lines.get(1)?.text).toStrictEqual({ kind: 'ended' });
    expect(lines.get(2)?.text).toStrictEqual({ kind: 'noInfo' });
  });

  it('shows no line on any stop once the whole line has ended, which the screen says once', () => {
    // Arrange
    const ended = line([{ stationIndex: 1, operation: 'ended', arrivals: [] }], 'ended');

    // Assert
    expect(isServiceOver(ended)).toBe(true);
    expect(arrivalLines(ended, NOW).size).toBe(0);
  });

  it('keeps a line with no data overnight (HSSC) apart from one that has ended', () => {
    expect(isServiceOver(line([], 'noData'))).toBe(false);
  });
});

describe('stationLine — a station the line passes without stopping (HSSC 혜화동로터리)', () => {
  const arriving = { text: { kind: 'arriving' as const }, isLastRun: true };

  it('says 미정차, and never an arrival or a bus badge', () => {
    const passThrough = { text: { kind: 'passThrough' }, isLastRun: false };
    expect(stationLine({ isPassThrough: true }, arriving)).toStrictEqual(passThrough);
    expect(stationLine({ isPassThrough: true }, undefined)).toStrictEqual(passThrough);
  });

  it('leaves a stop as its arrival says', () => {
    expect(stationLine({ isPassThrough: false }, arriving)).toBe(arriving);
    expect(stationLine({ isPassThrough: false }, undefined)).toBeUndefined();
  });
});

describe('low-floor buses (저상버스)', () => {
  function vehicle(id: string, isLowFloor: boolean | null): LiveVehicle {
    return { id, plateNumber: null, crowding: null, isLowFloor, position: null, trajectory: null };
  }
  const vehicles = [vehicle('a', true), vehicle('b', false), vehicle('c', null)];

  it('marks only the buses the source says are low-floor, on a line whose source can say', () => {
    expect([...lowFloorVehicleIds(vehicles, true)]).toStrictEqual(['a']);
  });

  it('marks none on a line whose source cannot say (HSSC), whatever a vehicle carries', () => {
    expect(lowFloorVehicleIds(vehicles, false).size).toBe(0);
  });
});

describe('formatArrivalText — n분 · m정류장, the same template shape in every language', () => {
  const inLanguage = (lang: 'ko' | 'en' | 'zh') => (text: ArrivalText) =>
    formatArrivalText(text, { t: (key) => t(lang, key), tpl: (key, ...args) => tpl(lang, key, ...args) });
  const minutes = (n: number, stopsAway: number | null): ArrivalText => ({ kind: 'minutes', minutes: n, stopsAway });

  it('reads the minutes and the stops away, with no 후 or 전', () => {
    expect(inLanguage('ko')(minutes(3, 4))).toBe('3분 · 4정류장');
    expect(inLanguage('en')(minutes(3, 4))).toBe('3 min · 4 stops');
    expect(inLanguage('zh')(minutes(3, 4))).toBe('3分钟 · 4站');
  });

  it('counts one stop in the singular', () => {
    expect(inLanguage('ko')(minutes(2, 1))).toBe('2분 · 1정류장');
    expect(inLanguage('en')(minutes(2, 1))).toBe('2 min · 1 stop');
    expect(inLanguage('zh')(minutes(2, 1))).toBe('2分钟 · 1站');
  });

  it('reads the minutes alone when the stops away are unknown', () => {
    expect(inLanguage('ko')(minutes(5, null))).toBe('5분');
    expect(inLanguage('en')(minutes(5, null))).toBe('5 min');
    expect(inLanguage('zh')(minutes(5, null))).toBe('5分钟');
  });

  it('keeps the special states and the source\'s own text as they were', () => {
    const ko = inLanguage('ko');
    expect(ko({ kind: 'arriving' })).toBe('곧 도착');
    expect(ko({ kind: 'waiting' })).toBe('출발대기');
    expect(ko({ kind: 'passThrough' })).toBe('미정차');
    expect(ko({ kind: 'message', text: '차고지 대기' })).toBe('차고지 대기');
  });
});
