/**
 * How transit shows on the shared map (ADR 0022): a line's route layer as the
 * entry's layer lens, the camera a stop opens on, the stop pins a sheet
 * publishes, and the stops as the map tab's places.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow, type LatLng } from '@skkuverse/shared';
import { FOCUSED_PLACE_LAYER } from '@/features/map/map.constants';
import type { MapOverlay } from '@/features/map/overlay.types';
import jongro07Directions from './__fixtures__/bus-config-realtime-jongro07-directions.json';
import {
  directionOnMap,
  lineMapOverlays,
  toDirectionLabels,
  toFocusedPlacePin,
  routeFramePoints,
  toRouteLayers,
  toStopCamera,
  toStopPins,
  stopRouteLayers,
  toStationPlaces,
  toStopPlaces,
  toStationRequest,
  toStopRequest,
  toTransitPlaceRequest,
  toTransitSheetKey,
} from './map-lens.rules';
import type { SubwayStation } from './subway/subway.types';
import { busGroupSchema } from './bus-config.schema';
import type { BusStop, LineStation, RealtimeScreenConfig } from './transit.types';
import { STOP_FOCUS_ZOOM } from '@/features/map/camera.constants';

const LAYERS = [{ id: 'building_numbers' }, { id: 'jongro07_route' }, { id: 'hssc_route' }];

describe('toRouteLayers', () => {
  it('names each line’s served route layer, on, and no layer for a line the config does not draw', () => {
    // Act & Assert
    expect(toRouteLayers(['hssc'], LAYERS)).toStrictEqual({ hssc_route: true });
    expect(toRouteLayers(['jongro07', 'hssc'], LAYERS)).toStrictEqual({ jongro07_route: true, hssc_route: true });
    expect(toRouteLayers(['campus'], LAYERS)).toStrictEqual({});
    expect(toRouteLayers([], LAYERS)).toStrictEqual({});
  });
});

const HYEHWA: LatLng = { lat: 37.5834729904, lng: 127.0017632862 };
const STADIUM: LatLng = { lat: 37.5906, lng: 126.9922 };

describe('toStopCamera', () => {
  it('opens a stop at the reference’s zoom, whatever the config’s marker focus serves, with the rest of its motion', () => {
    // Act
    const camera = toStopCamera(HYEHWA, { zoom: 17.5, tilt: 10, bearing: 30, durationMs: 300 });

    // Assert
    // 16 under Naver's zoom numbering, one level deeper than Web Mercator's: the reference's 0.90 m/pt.
    expect(STOP_FOCUS_ZOOM).toBe(16);
    expect(camera).toStrictEqual({ lat: HYEHWA.lat, lng: HYEHWA.lng, zoom: 16, tilt: 10, bearing: 30, durationMs: 300 });
  });
});

const station = (index: number, name: string, stopId: string | undefined, coords: LatLng | null, towards: LineStation['towards']): LineStation => ({
  station: {
    index,
    name,
    isFirstStation: index === 0,
    isLastStation: false,
    isRotationStation: false,
    isPassThrough: false,
    isAlightOnly: false,
    transferLines: [],
    ...(stopId && { stopId }),
  },
  stopId: stopId ?? null,
  name: stopId ? { ko: name, en: name } : null,
  coords,
  campus: stopId === 'seoul-01617' ? null : 'hssc',
  towards,
});

describe('toStopPins', () => {
  it('publishes one marker per station with coordinates, captioned with its stop name and where it heads, a tap opening its stop', () => {
    // Act
    const pins = toStopPins(
      'jongro07',
      [
        station(16, '혜화역1번출구', 'seoul-01592', HYEHWA, { ko: '혜화동로터리', en: 'Hyehwa Rotary' }),
        station(17, '가상 정류장', undefined, null, null),
        station(21, '성균관대운동장', 'seoul-01617', STADIUM, null),
      ],
      (name) => `${name} 방면`,
    );

    // Assert
    expect(pins.map((p) => p.id)).toStrictEqual(['seoul-01592', 'seoul-01617']);
    expect(pins[0]).toMatchObject({
      kind: 'marker',
      role: 'stop',
      layerId: 'jongro07_stops',
      campus: 'hssc',
      lat: HYEHWA.lat,
      lng: HYEHWA.lng,
      text: { ko: '혜화역1번출구', en: '혜화역1번출구' },
      subtitle: { ko: '혜화동로터리 방면', en: 'Hyehwa Rotary 방면' },
      order: 16,
      // The tap names the line and the station, so the stop it opens steps along the line (‹ ›).
      tap: { kind: 'bus_stop', placeId: 'seoul-01592', line: { groupId: 'jongro07', stationIndex: 16 } },
    });
    expect(pins[1]?.subtitle).toBeNull();
    expect(pins[1]?.campus).toBe('hssc');
  });

  it("colours every pin with the route layer's served colour, which a zoomed-out stop dot takes", () => {
    // Act
    const pins = toStopPins('jongro07', [station(16, '혜화역1번출구', 'seoul-01592', HYEHWA, null)], (name) => name, '4CAF50');

    // Assert
    expect(pins[0]?.color).toBe('4CAF50');
  });

  it('leaves the colour to the renderer when the route layer serves none', () => {
    // Act
    const pins = toStopPins('jongro07', [station(16, '혜화역1번출구', 'seoul-01592', HYEHWA, null)], (name) => name);

    // Assert
    expect(pins[0]?.color).toBeUndefined();
  });
});

describe('toDirectionLabels', () => {
  const group = parseOrThrow(busGroupSchema, jongro07Directions.data, 'bus config');
  if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
  const screen: RealtimeScreenConfig = group.screen;
  const coordsOf = (index: number): LatLng => ({ lat: 37.58 + index / 1000, lng: 126.99 + index / 1000 });
  const lineStations = (located: (index: number) => boolean): LineStation[] =>
    screen.stations.map((s) => ({
      station: s,
      stopId: s.stopId ?? null,
      name: { ko: s.name, en: s.name },
      coords: located(s.index) ? coordsOf(s.index) : null,
      campus: 'hssc',
      towards: null,
    }));

  it('labels each served direction once, inert, at the middle stop of its run', () => {
    // Act
    const labels = toDirectionLabels('jongro07', screen.directions, lineStations(() => true));

    // Assert
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatchObject({
      kind: 'marker',
      role: 'directionLabel',
      id: 'jongro07:direction:100900043',
      layerId: 'jongro07_directions',
      campus: 'hssc',
      text: { ko: '이화사거리 방면', en: '이화사거리 방면' },
      subtitle: null,
      tap: null,
      order: 0,
      ...coordsOf(12),
    });
    expect(labels[1]).toMatchObject({
      role: 'directionLabel',
      id: 'jongro07:direction:100900220',
      text: { ko: '성균관대운동장 방면', en: '성균관대운동장 방면' },
      tap: null,
      order: 1,
      ...coordsOf(14),
    });
  });

  it('labels no direction none of whose stations has coordinates', () => {
    // Act
    const labels = toDirectionLabels('jongro07', screen.directions, lineStations((index) => index <= 12));

    // Assert
    expect(labels.map((l) => l.id)).toStrictEqual(['jongro07:direction:100900043']);
  });
});

describe('directionOnMap: the direction whose stops the map draws', () => {
  const OUT = { id: 'out', label: '종로5가 방면', fromIndex: 0, toIndex: 15 };
  const BACK = { id: 'back', label: '명륜3가 방면', fromIndex: 16, toIndex: 30 };

  it('is the direction tab the list shows, on a line with two', () => {
    expect(directionOnMap([OUT, BACK], 'back')).toBe(BACK);
    expect(directionOnMap([OUT, BACK], 'out')).toBe(OUT);
  });

    it("is the selected tab on HSSC's loop as well, whose 하교 and 등교 are distinct stops", () => {
    const DOWN = { id: 'fromCampus', label: '하교', fromIndex: 0, toIndex: 5 };
    const UP = { id: 'toCampus', label: '등교', fromIndex: 6, toIndex: 10 };
    expect(directionOnMap([DOWN, UP], 'toCampus')).toBe(UP);
  });

  it('is none on a line with one direction or none, and before a tab is known', () => {
    expect(directionOnMap([OUT], 'out')).toBeNull();
    expect(directionOnMap([], null)).toBeNull();
    expect(directionOnMap([OUT, BACK], null)).toBeNull();
    expect(directionOnMap([OUT, BACK], 'gone')).toBeNull();
  });
});

describe('lineMapOverlays: what a line sheet publishes to the map', () => {
  const group = parseOrThrow(busGroupSchema, jongro07Directions.data, 'bus config');
  if (group.screenType !== 'realtime') throw new Error('expected a realtime group');
  const screen: RealtimeScreenConfig = group.screen;
  const coordsOf = (index: number): LatLng => ({ lat: 37.58 + index / 1000, lng: 126.99 + index / 1000 });
  const stations: LineStation[] = screen.stations.map((s) => ({
    station: s,
    stopId: s.stopId ?? `stop-${s.index}`,
    name: { ko: s.name, en: s.name },
    coords: coordsOf(s.index),
    campus: 'hssc',
    towards: null,
  }));
  const [first, second] = screen.directions;
  if (!first || !second) throw new Error('expected two directions');
  const inputs = { groupId: 'jongro07', stations, directions: screen.directions, towardsLabel: (n: string) => n };
  const stopIdsOf = (dir: { fromIndex: number; toIndex: number }) =>
    stations.filter((s) => s.station.index >= dir.fromIndex && s.station.index <= dir.toIndex).map((s) => s.stopId);

  it("draws only the selected direction's stops and its one label", () => {
    // Act
    const overlays = lineMapOverlays({ ...inputs, selectedDirectionId: second.id });

    // Assert
    expect(overlays.filter((o) => o.role === 'stop').map((o) => o.id)).toStrictEqual(stopIdsOf(second));
    expect(overlays.filter((o) => o.role === 'directionLabel').map((o) => o.id)).toStrictEqual([`jongro07:direction:${second.id}`]);
  });

  it('swaps to the other direction when the tab does', () => {
    // Act
    const overlays = lineMapOverlays({ ...inputs, selectedDirectionId: first.id });

    // Assert
    expect(overlays.filter((o) => o.role === 'stop').map((o) => o.id)).toStrictEqual(stopIdsOf(first));
    expect(overlays.filter((o) => o.role === 'directionLabel').map((o) => o.id)).toStrictEqual([`jongro07:direction:${first.id}`]);
  });

  it("colours the stops with the route's colour", () => {
    // Act
    const overlays = lineMapOverlays({ ...inputs, selectedDirectionId: first.id, routeColor: '4CAF50' });

    // Assert
    expect(overlays.filter((o) => o.role === 'stop').every((o) => o.color === '4CAF50')).toBe(true);
  });
});

describe('toFocusedPlacePin', () => {
  it('publishes the one place a stop or station sheet is open on', () => {
    // Act
    const pin = toFocusedPlacePin({ id: 'hyehwa', name: '혜화', coords: HYEHWA });

    // Assert
    expect(pin).toMatchObject({
      kind: 'marker',
      role: 'focusedPlace',
      id: 'hyehwa',
      layerId: FOCUSED_PLACE_LAYER,
      campus: 'hssc',
      text: { ko: '혜화', en: '혜화' },
      subtitle: null,
      lat: HYEHWA.lat,
      lng: HYEHWA.lng,
      tap: null,
    });
  });
});

describe('toStopRequest and toStationRequest: the requests a link or a pin opens on the map', () => {
  it('opens a stop with what asked for it, and a line pin’s line so the sheet steps along it', () => {
    // Arrange
    const line = { groupId: 'jongro07', stationIndex: 16 };

    // Act & Assert
    expect(toStopRequest({ placeId: '01-123', source: 'pin' })).toStrictEqual({ kind: 'bus_stop', stopId: '01-123', source: 'pin' });
    expect(toStopRequest({ placeId: '01-123', source: 'pin', line })).toStrictEqual({
      kind: 'bus_stop',
      stopId: '01-123',
      source: 'pin',
      line,
    });
  });

  it('opens a station with what asked for it', () => {
    // Act & Assert
    expect(toStationRequest({ placeId: '0150', source: 'deeplink' })).toStrictEqual({
      kind: 'subway_station',
      stationId: '0150',
      source: 'deeplink',
    });
  });
});

describe('toTransitSheetKey: what makes two transit requests one sheet', () => {
  it('names a place reached two ways one sheet: the source and the line it came from are not part of it', () => {
    // Act & Assert
    expect(toTransitSheetKey({ kind: 'bus_stop', stopId: '01-123', source: 'pin', line: { groupId: 'hssc', stationIndex: 2 } })).toBe(
      toTransitSheetKey({ kind: 'bus_stop', stopId: '01-123', source: 'deeplink' }),
    );
    expect(toTransitSheetKey({ kind: 'line', groupId: 'hssc', source: 'tab' })).toBe(
      toTransitSheetKey({ kind: 'line', groupId: 'hssc', source: 'deeplink' }),
    );
    expect(toTransitSheetKey({ kind: 'subway_station', stationId: '0150', line: '4', source: 'sdui' })).toBe(
      toTransitSheetKey({ kind: 'subway_station', stationId: '0150', source: 'search' }),
    );
  });

  it('tells two places, and two kinds with one id, apart', () => {
    // Act & Assert
    expect(toTransitSheetKey({ kind: 'bus_stop', stopId: '01-123', source: 'pin' })).not.toBe(
      toTransitSheetKey({ kind: 'bus_stop', stopId: '01-124', source: 'pin' }),
    );
    expect(toTransitSheetKey({ kind: 'line', groupId: 'x', source: 'pin' })).not.toBe(
      toTransitSheetKey({ kind: 'bus_stop', stopId: 'x', source: 'pin' }),
    );
  });
});

describe('toTransitPlaceRequest', () => {
  it('turns a transit place link into its sheet request with what asked for it, and anything else into none', () => {
    // Act & Assert
    expect(toTransitPlaceRequest({ kind: 'bus_stop', placeId: 'seoul-01592' })).toStrictEqual({
      kind: 'bus_stop',
      stopId: 'seoul-01592',
      source: 'deeplink',
    });
    expect(toTransitPlaceRequest({ kind: 'subway_station', placeId: 'hyehwa', source: 'search' })).toStrictEqual({
      kind: 'subway_station',
      stationId: 'hyehwa',
      source: 'search',
    });
    expect(toTransitPlaceRequest({ kind: 'skku_building', placeId: '1' })).toBeNull();
    expect(toTransitPlaceRequest({ kind: null, placeId: 'booth-1' })).toBeNull();
  });
});

describe('toStationPlaces', () => {
  const station = (id: string, coords: LatLng | null): SubwayStation => ({ id, title: `${id}역`, campus: null, lines: [], coords });

  it('serves each station with coords to the map, drawing no layer', () => {
    // Act
    const places = toStationPlaces([station('hyehwa', HYEHWA), station('jamsil', null)]);

    // Assert
    expect(places).toStrictEqual([
      {
        id: 'hyehwa',
        name: { ko: 'hyehwa역', en: 'hyehwa역', zh: 'hyehwa역' },
        coords: HYEHWA,
        layers: {},
      },
    ]);
  });
});

describe('toStopPlaces', () => {
  const timetable = (groupId: string): BusStop['routes'][number] => ({
    kind: 'timetable',
    groupId,
    label: { ko: groupId, en: groupId },
    serviceId: 's',
    routeType: 'r',
    action: 'board',
  });
  const stop = (id: string, routes: BusStop['routes']): BusStop => ({
    id,
    name: { ko: id, en: id },
    coords: HYEHWA,
    campus: 'hssc',
    routes,
  });

  it('serves each stop to the map with the route layers of the lines that stop there', () => {
    // Act
    const places = toStopPlaces(
      [stop('seoul-01592', [timetable('jongro07'), timetable('jongro08')]), stop('hssc-bus-lot', [timetable('campus')])],
      LAYERS,
    );

    // Assert
    expect(places.map((p) => [p.id, p.layers])).toStrictEqual([
      ['seoul-01592', { jongro07_route: true }],
      ['hssc-bus-lot', {}],
    ]);
  });
});

describe('stopRouteLayers', () => {
  const stop = (id: string, groupIds: string[]): BusStop => ({
    id,
    name: { ko: id, en: id },
    coords: HYEHWA,
    campus: 'hssc',
    routes: groupIds.map((groupId) => ({
      kind: 'live',
      groupId,
      label: { ko: groupId, en: groupId },
      stationIndex: 0,
      towards: null,
      action: 'board',
    })),
  });

  it('draws the route of every line that stops at the stop', () => {
    // Arrange
    const stops = [stop('seoul-01592', ['jongro07', 'hssc']), stop('seoul-01617', ['jongro02'])];

    // Act & Assert
    expect(stopRouteLayers(stops, 'seoul-01592', 'jongro07', LAYERS)).toStrictEqual({
      jongro07_route: true,
      hssc_route: true,
    });
  });

  it('draws the line it was opened from while the stops are not loaded, or do not hold the stop', () => {
    expect(stopRouteLayers(undefined, 'seoul-01592', 'jongro07', LAYERS)).toStrictEqual({ jongro07_route: true });
    expect(stopRouteLayers([stop('seoul-01617', ['hssc'])], 'seoul-01592', 'jongro07', LAYERS)).toStrictEqual({
      jongro07_route: true,
    });
  });
});

describe('routeFramePoints: what a line is framed on', () => {
  const stations = [
    station(16, '혜화역1번출구', 'seoul-01592', HYEHWA, null),
    station(17, '가상 정류장', undefined, null, null),
    station(21, '성균관대운동장', 'seoul-01617', STADIUM, null),
  ];
  const path = (layerId: string, line: LatLng[]): MapOverlay => ({
    kind: 'path',
    id: `${layerId}-1`,
    layerId,
    line,
    campus: 'hssc',
    text: { ko: '', en: '' },
    subtitle: null,
    hours: [],
    fields: [],
    actions: [],
    order: 0,
    facets: {},
    orderByOption: {},
    tap: null,
  });
  const LOOP: LatLng[] = [HYEHWA, { lat: 37.59, lng: 127.003 }, STADIUM];

  it('frames the served route path when the overlays hold it, so the frame covers the whole line and not just its stops', () => {
    expect(routeFramePoints([path('jongro07_route', LOOP)], 'jongro07', stations)).toBe(LOOP);
  });

  it('falls back to the stops’ coordinates, unknown ones included, without the path: another line’s, a marker on the layer, or no overlays yet', () => {
    const stops = [HYEHWA, null, STADIUM];
    expect(routeFramePoints([path('hssc_route', LOOP)], 'jongro07', stations)).toStrictEqual(stops);
    expect(routeFramePoints(undefined, 'jongro07', stations)).toStrictEqual(stops);
    expect(routeFramePoints([], 'jongro07', stations)).toStrictEqual(stops);
  });
});
