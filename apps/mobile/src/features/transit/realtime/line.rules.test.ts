/**
 * The line sheet's list (ADR 0022 d3): each station joined to its stop on
 * the list, and the directions as sections of one continuous list.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { isLineExpand, isPlaced, toLineSections, toLineStations } from './line.rules';
import { busStopsSchema } from '../stops.schema';
import { busGroupSchema } from '../bus-config.schema';
import stopsFixture from '../__fixtures__/bus-stops-hssc-shuttle-and-poles.json';
import jongro07Directions from '../__fixtures__/bus-config-realtime-jongro07-directions.json';
import jongro07 from '../__fixtures__/bus-config-realtime-jongro07.json';
import hsscAlightOnly from '../__fixtures__/bus-config-realtime-hssc-alight-only.json';
import type { LiveVehicle, RealtimeScreenConfig, RealtimeStation } from '../transit.types';

const STOPS = parseOrThrow(busStopsSchema, stopsFixture.data, 'stops');

function realtimeScreen(data: unknown): RealtimeScreenConfig {
  const group = parseOrThrow(busGroupSchema, data, 'bus config');
  if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
  return group.screen;
}

/** 혜화역1번출구 as /bus/config/jongro07 serves it (index 16), which the list fixture holds as seoul-01592. */
const HYEHWA_STATION: RealtimeStation = {
  index: 16,
  name: '혜화역1번출구',
  stationNumber: '01592',
  isFirstStation: false,
  isLastStation: false,
  isRotationStation: false,
  isPassThrough: false,
  isAlightOnly: false,
  transferLines: [{ line: '4', color: '00A5DE' }],
  stopId: 'seoul-01592',
};

describe('toLineStations', () => {
  it('joins a station to its stop by stopId for its coordinates, name and the next stop it heads to', () => {
    // Act
    const joined = toLineStations('jongro07', [HYEHWA_STATION], STOPS);

    // Assert
    expect(joined).toStrictEqual([
      {
        station: HYEHWA_STATION,
        stopId: 'seoul-01592',
        name: { ko: '혜화역1번출구', en: '혜화역1번출구', zh: '혜화역1번출구' },
        coords: { lat: 37.5834729904, lng: 127.0017632862 },
        campus: 'hssc',
        towards: { ko: '혜화동로터리', en: '혜화동로터리', zh: '혜화동로터리' },
      },
    ]);
  });

  it('leaves a station without a page, or one the list does not hold, with no coordinates', () => {
    // Arrange
    const unlisted = realtimeScreen(jongro07.data).stations[0]!;
    const noPage = { ...unlisted, stopId: undefined };

    // Act
    const [a, b] = toLineStations('jongro07', [unlisted, noPage], STOPS);

    // Assert
    expect(unlisted.stopId).toBe('seoul-01617');
    expect(a).toMatchObject({ stopId: 'seoul-01617', name: null, coords: null, campus: null, towards: null });
    expect(b).toMatchObject({ stopId: null, name: null, coords: null, campus: null, towards: null });
  });

  it('reads where a shared pole heads from this line\u2019s entry, not the other line\u2019s', () => {
    // Arrange
    const stops = STOPS.map((s) =>
      s.id === 'seoul-01592'
        ? {
            ...s,
            routes: [
              { ...s.routes[1]!, towards: { ko: '다른 곳', en: 'elsewhere' } },
              { ...s.routes[0]!, towards: null },
            ],
          }
        : s,
    );

    // Act
    const [joined] = toLineStations('jongro07', [HYEHWA_STATION], stops);

    // Assert
    expect(joined?.towards).toBeNull();
  });
});

describe('toLineSections', () => {
  it('makes one section per served direction, starting at the row of its first station', () => {
    // Arrange
    const screen = realtimeScreen(jongro07Directions.data);

    // Act
    const sections = toLineSections(screen);

    // Assert
    expect(sections).toStrictEqual([
      { id: '100900043', label: '이화사거리 방면', firstRow: 0 },
      { id: '100900220', label: '성균관대운동장 방면', firstRow: 2 },
    ]);
  });

  it('reads the continuous list as the directions one after another: each section holds exactly its range', () => {
    // Arrange
    const screen = realtimeScreen(jongro07Directions.data);

    // Act
    const sections = toLineSections(screen);

    // Assert
    screen.directions.forEach((direction, i) => {
      const rows = screen.stations.slice(sections[i]!.firstRow, sections[i + 1]?.firstRow);
      const inRange = screen.stations.filter((s) => s.index >= direction.fromIndex && s.index <= direction.toIndex);
      expect(rows.map((s) => s.index)).toStrictEqual(inRange.map((s) => s.index));
    });
  });

  it('gives no section to a direction with no station in the list', () => {
    // Arrange
    const screen = realtimeScreen(hsscAlightOnly.data);

    // Act
    const sections = toLineSections(screen);

    // Assert
    expect(screen.directions.map((d) => d.id)).toStrictEqual(['fromCampus', 'toCampus']);
    expect(sections).toStrictEqual([{ id: 'fromCampus', label: 'From campus', firstRow: 0 }]);
  });

  it('makes no section for a line without directions: one list, no tabs', () => {
    // Act & Assert
    expect(toLineSections(realtimeScreen(jongro07.data))).toStrictEqual([]);
  });
});

describe('isLineExpand: the full-height measurement (ADR 0022, Measuring it)', () => {
  it('counts the sheet reaching its top detent', () => {
    expect(isLineExpand('page', false)).toBe(true);
  });

  it.each(['min', 'mid'] as const)('does not count %s', (detent) => {
    expect(isLineExpand(detent, false)).toBe(false);
  });

  it('does not count a sheet a screen reader opened at the top: the user did not drag it there', () => {
    expect(isLineExpand('page', true)).toBe(false);
  });
});

describe('isPlaced: a bus with a position, the only kind that gets a marker', () => {
  const bus = (position: LiveVehicle['position']): LiveVehicle => ({
    id: 'b1', plateNumber: null, crowding: null, isLowFloor: null, position, trajectory: null,
  });
  const position = {
    stationIndex: 0, status: 'atStop', progress: null, sectionMeters: null, nextStationAtMs: null, positionAtMs: 0, checkedAtMs: 0,
  } as const;

  it.each([
    ['a positioned bus', bus(position), true],
    ['a bus an arrival names without a position', bus(null), false],
  ])('%s', (_name, vehicle, expected) => {
    // Act & Assert
    expect(isPlaced(vehicle)).toBe(expected);
  });
});
