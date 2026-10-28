/**
 * The stop sheet's rows (ADR 0022 d4): one per route serving the pole, by
 * kind, counted down at the server's clock.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { kstClockOf, lineEntryOf, toLineNeighbours, toStopSheetRows } from './stop.rules';
import { stopArrivalsSchema } from '../stops.schema';
import { busGroupSchema } from '../bus-config.schema';
import hsscConfig from '../__fixtures__/bus-config-realtime-hssc.json';
import jongro07Config from '../__fixtures__/bus-config-realtime-jongro07.json';
import hyehwaPole from '../__fixtures__/stop-arrivals-seoul-01592.json';
import busLot from '../__fixtures__/stop-arrivals-hssc-bus-lot.json';
import olympicHall from '../__fixtures__/stop-arrivals-hssc-olympic-hall.json';

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-10-20T14:10:00+09:00');
const META = { lang: 'ko', serverNow: '2026-10-20T14:10:00+09:00' };
const page = (fixture: { data: unknown }) => parseOrThrow(stopArrivalsSchema, { meta: META, data: fixture.data }, 'stop page');

describe('toStopSheetRows', () => {
  it('lists each live line with its direction, the next stop and the arrival counted down now', () => {
    // Act
    const rows = toStopSheetRows(page(hyehwaPole), NOW);

    // Assert
    expect(rows).toStrictEqual([
      {
        kind: 'live',
        key: 'jongro07',
        label: '종로 07',
        direction: '성균관대운동장 방면',
        towards: '혜화동로터리',
        isAlightOnly: false,
        arrival: { text: { kind: 'minutes', minutes: 4, stopsAway: 3 }, isLastRun: false },
      },
      {
        kind: 'live',
        key: 'jongro08',
        label: '종로 08',
        direction: '명륜3가 방면',
        towards: '혜화동로터리',
        isAlightOnly: false,
        arrival: { text: { kind: 'noInfo' }, isLastRun: false },
      },
    ]);
  });

  it('lists a timetable route with its next run at this stop, and keys two route types of one service apart', () => {
    // Act
    const rows = toStopSheetRows(page(busLot), NOW);

    // Assert
    expect(rows.map((r) => r.key)).toStrictEqual(['campus:campus-inja:regular', 'campus:campus-inja:hakbu', 'jongro07']);
    expect(rows[0]).toStrictEqual({
      kind: 'timetable',
      key: 'campus:campus-inja:regular',
      label: '인사캠 → 자과캠',
      isAlightOnly: false,
      operation: 'running',
      next: { runDepartureAtMs: at('2026-10-20T14:30:00+09:00'), atMs: at('2026-10-20T14:30:00+09:00'), isEstimate: false, isLastRun: false },
    });
    expect(rows[1]).toMatchObject({ kind: 'timetable', next: { isLastRun: true } });
  });

  it('marks a drop-off-only stop on its row from the entry’s action', () => {
    // Act
    const rows = toStopSheetRows(page(olympicHall), NOW);

    // Assert
    expect(rows[0]).toMatchObject({ kind: 'live', isAlightOnly: true, direction: '하교', towards: '혜화동우체국' });
  });

  it('shows a line whose service is over as ended, and a route with no run as none', () => {
    // Arrange
    const ended = page(hyehwaPole);
    const live = ended.routes[0]!;
    if (live.kind !== 'live') throw new Error('expected a live entry');
    live.operation = 'ended';
    const idle = page(busLot);
    const timetable = idle.routes[0]!;
    if (timetable.kind !== 'timetable') throw new Error('expected a timetable entry');
    timetable.operation = 'suspended';
    timetable.runs = [];

    // Act
    const [endedRow] = toStopSheetRows(ended, NOW);
    const [idleRow] = toStopSheetRows(idle, NOW);

    // Assert
    expect(endedRow).toMatchObject({ kind: 'live', arrival: { text: { kind: 'ended' } } });
    expect(idleRow).toMatchObject({ kind: 'timetable', operation: 'suspended', next: null });
  });

  it('lists nothing for a page with no route', () => {
    // Act & Assert
    expect(toStopSheetRows({ ...page(hyehwaPole), routes: [] }, NOW)).toStrictEqual([]);
  });
});

describe('kstClockOf', () => {
  it('reads an instant as the KST wall clock, whatever zone the device is set to', () => {
    // Act & Assert
    expect(kstClockOf(at('2026-10-20T14:30:00+09:00'))).toBe('14:30');
    expect(kstClockOf(at('2026-10-20T00:05:00+09:00'))).toBe('00:05');
    expect(kstClockOf(Date.parse('2026-10-19T23:59:00Z'))).toBe('08:59');
  });
});

const realtimeStations = (fixture: { data: unknown }) => {
  const group = parseOrThrow(busGroupSchema, fixture.data, 'bus config');
  if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
  return group.screen.stations;
};

describe('toLineNeighbours: the stop sheet’s ‹ ›', () => {
  it('steps over a position without a page, both ways', () => {
    // Arrange
    const stations = realtimeStations(hsscConfig);

    // Act
    const fromPostOffice = toLineNeighbours(stations, 4);
    const fromExit1 = toLineNeighbours(stations, 6);

    // Assert
    expect(stations.map((s) => [s.index, s.stopId ?? null])).toStrictEqual([
      [4, 'hssc-hyehwa-post-office'],
      [5, null],
      [6, 'hssc-hyehwa-exit1'],
    ]);
    expect(fromPostOffice.next?.stopId).toBe('hssc-hyehwa-exit1');
    expect(fromExit1.prev?.stopId).toBe('hssc-hyehwa-post-office');
  });

  it('has no stop before the line’s first or after its last', () => {
    // Arrange
    const stations = realtimeStations(jongro07Config);

    // Act
    const first = toLineNeighbours(stations, 0);
    const last = toLineNeighbours(stations, 1);

    // Assert
    expect(first.prev).toBeNull();
    expect(first.next?.index).toBe(1);
    expect(last.prev?.index).toBe(0);
    expect(last.next).toBeNull();
  });
});

describe('lineEntryOf: the toward line under a stop opened from a line', () => {
  it('reads where the line heads from this stop', () => {
    expect(lineEntryOf(page(hyehwaPole), 'jongro07')).toStrictEqual({ towards: '혜화동로터리' });
  });

  it('reads a line’s last stop as heading nowhere', () => {
    // Arrange
    const terminal = page(hyehwaPole);
    const live = terminal.routes[0]!;
    if (live.kind !== 'live') throw new Error('expected a live entry');
    live.towards = null;

    // Act & Assert
    expect(lineEntryOf(terminal, 'jongro07')).toStrictEqual({ towards: null });
  });

  it('has no entry for a line the page does not list live', () => {
    expect(lineEntryOf(page(hyehwaPole), 'hssc')).toBeNull();
    expect(lineEntryOf(page(busLot), 'campus')).toBeNull();
  });
});
