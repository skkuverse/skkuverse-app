/** Where the camera looks when the map opens a place. */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CAMERA_DEFAULTS, FALLBACK_CAMPUS } from './map.constants';
import {
  markerFocusOn,
  toBuildingCamera,
  toCampusCamera,
  toInitialCamera,
  toPlaceCamera,
  toPointCamera,
  toRestoreCamera,
} from './camera-targets.rules';
import type { MapConfig } from './map-config.types';
import type { MapOverlay } from './overlay.types';

const CONFIG: MapConfig = {
  naver: {},
  campuses: [
    {
      id: 'hssc',
      label: '인사캠',
      centerLat: 37.58,
      centerLng: 126.99,
      defaultZoom: 15.8,
      defaultTilt: 0,
      defaultBearing: 0,
    },
    {
      id: 'nsc',
      label: '자과캠',
      centerLat: 37.29,
      centerLng: 126.97,
      defaultZoom: 15.6,
      defaultTilt: 12,
      defaultBearing: 28,
    },
  ],
  layers: [],
  chips: [],
  cameraDefaults: {
    markerFocus: { zoom: 17.5, tilt: 3, bearing: 7, durationMs: 500 },
    campusFocus: { durationMs: 700 },
  },
};

describe('markerFocusOn: the server zoom with the campus attitude', () => {
  it('takes tilt and bearing from the campus the place is on', () => {
    expect(markerFocusOn(CONFIG, 'nsc')).toEqual({ zoom: 17.5, tilt: 12, bearing: 28, durationMs: 500 });
    expect(markerFocusOn(CONFIG, 'hssc')).toEqual({ zoom: 17.5, tilt: 0, bearing: 0, durationMs: 500 });
  });

  it('keeps the global attitude for a campus the config does not list', () => {
    const config = { ...CONFIG, campuses: [] };
    expect(markerFocusOn(config, 'nsc')).toEqual(CONFIG.cameraDefaults.markerFocus);
  });

  it('falls back to the client defaults before the config has arrived', () => {
    expect(markerFocusOn(null, 'hssc')).toEqual(DEFAULT_CAMERA_DEFAULTS.markerFocus);
  });
});

describe('toBuildingCamera: opening a building moves the camera onto it', () => {
  const BUILDING = { lat: 37.2939, lng: 126.9745, campus: 'nsc' as const };

  it.each(['deeplink', 'search', 'building_sheet', 'list', 'miniapp'] as const)(
    'frames a building opened from %s, at the marker zoom with its campus attitude',
    (source) => {
      // Act
      const camera = toBuildingCamera(BUILDING, source, CONFIG);

      // Assert
      expect(camera).toEqual({ lat: BUILDING.lat, lng: BUILDING.lng, zoom: 17.5, tilt: 12, bearing: 28, durationMs: 500 });
    },
  );

  it('leaves the camera where it is for a pin the user tapped, which is already on screen', () => {
    // Act
    const camera = toBuildingCamera(BUILDING, 'pin', CONFIG);

    // Assert
    expect(camera).toBeNull();
  });

  it('moves nothing for a building the server placed at no coordinate', () => {
    // Act
    const camera = toBuildingCamera({ ...BUILDING, lat: 0, lng: 0 }, 'deeplink', CONFIG);

    // Assert
    expect(camera).toBeNull();
  });
});

describe('toPlaceCamera: a place opened from a link or a list row', () => {
  const BASE = {
    id: 'eskara26-booth-3',
    layerId: 'eskara26_bar',
    campus: 'nsc' as const,
    text: { ko: '부스', en: 'Booth' },
    subtitle: null,
    hours: [],
    fields: [],
    actions: [],
    order: 0,
    facets: {},
    orderByOption: {},
    tap: { kind: 'event' as const, placeId: 'eskara26-booth-3' },
  };

  it.each<[string, MapOverlay, { lat: number; lng: number }]>([
    [
      'a pin, at its coordinate',
      { ...BASE, kind: 'marker', lat: 37.2939, lng: 126.9745, pinPriority: 0, locationAccuracy: 'exact' },
      { lat: 37.2939, lng: 126.9745 },
    ],
    [
      "a zone, at its exterior ring's centre",
      { ...BASE, kind: 'polygon', rings: [[{ lat: 37.29, lng: 126.97 }, { lat: 37.3, lng: 126.98 }]] },
      { lat: 37.295, lng: 126.975 },
    ],
  ])('frames %s, at the marker zoom with its campus attitude', (_, place, at) => {
    // Act
    const camera = toPlaceCamera(CONFIG, place);

    // Assert
    expect(camera.lat).toBeCloseTo(at.lat, 9);
    expect(camera.lng).toBeCloseTo(at.lng, 9);
    expect(camera).toMatchObject({ zoom: 17.5, tilt: 12, bearing: 28, durationMs: 500 });
  });
});

describe("toCampusCamera: a campus framed at its own centre and attitude", () => {
  it('takes the centre, zoom, tilt and bearing from the campus, with the duration asked', () => {
    // Arrange
    const nsc = CONFIG.campuses[1]!;

    // Act
    const camera = toCampusCamera(nsc, 700);

    // Assert
    expect(camera).toEqual({ lat: 37.29, lng: 126.97, zoom: 15.6, tilt: 12, bearing: 28, durationMs: 700 });
  });
});

describe('toPointCamera: a frame that folded to one point', () => {
  it('jumps there at the marker-focus zoom and attitude, with no animation', () => {
    // Act
    const camera = toPointCamera({ lat: 37.58, lng: 126.99 }, CONFIG.cameraDefaults.markerFocus);

    // Assert
    expect(camera).toEqual({ lat: 37.58, lng: 126.99, zoom: 17.5, tilt: 3, bearing: 7, durationMs: 0 });
  });
});

describe('toRestoreCamera: a sheet revealed by a pop gets its camera back', () => {
  it('restores the whole camera with no animation', () => {
    // Arrange
    const snapshot = { latitude: 37.29, longitude: 126.97, zoom: 17, tilt: 30, bearing: 6 };

    // Act
    const target = toRestoreCamera(snapshot);

    // Assert
    expect(target).toEqual({ lat: 37.29, lng: 126.97, zoom: 17, tilt: 30, bearing: 6, durationMs: 0 });
  });
});

describe("toInitialCamera: the map's camera at mount", () => {
  it('starts on the selected campus, else the first one served', () => {
    // Act / Assert
    expect(toInitialCamera(CONFIG.campuses, 'nsc')).toEqual({
      latitude: 37.29,
      longitude: 126.97,
      zoom: 15.6,
      tilt: 12,
      bearing: 28,
    });
    expect(toInitialCamera(CONFIG.campuses.slice(0, 1), 'nsc')).toMatchObject({ latitude: 37.58, zoom: 15.8 });
  });

  it('starts on the fallback campus when the config serves none', () => {
    // Act
    const camera = toInitialCamera([], 'hssc');

    // Assert
    expect(camera).toEqual({
      latitude: FALLBACK_CAMPUS.centerLat,
      longitude: FALLBACK_CAMPUS.centerLng,
      zoom: FALLBACK_CAMPUS.defaultZoom,
      tilt: 0,
      bearing: 0,
    });
  });
});
