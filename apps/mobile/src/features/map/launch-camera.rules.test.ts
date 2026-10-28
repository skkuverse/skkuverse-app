/**
 * Where the shared camera starts at a cold start (ADR 0022 d1), against the
 * real campus centres `GET /map/config` serves.
 */

import { describe, expect, it } from 'vitest';
import { parseOrThrow, type LatLng } from '@skkuverse/shared';
import configProduction from './__fixtures__/server-map-config.production-ko.json';
import { mapConfigSchema } from './map-config.schema';
import type { CampusDef } from './map-config.types';
import {
  NO_NEARBY,
  campusToFollowAtLaunch,
  decideLaunchCamera,
  launchCameraOf,
  launchNearbyOf,
} from './launch-camera.rules';
import { DEFAULT_CAMPUS_RADIUS_M } from './map.constants';
import { NEAR_SERVED_PLACE_M } from './camera.constants';

const HSSC: LatLng = { lat: 37.587241, lng: 126.992858 };
const NSC: LatLng = { lat: 37.29358, lng: 126.974942 };

const campus = (id: 'hssc' | 'nsc', over: Partial<CampusDef> = {}): CampusDef => ({
  id,
  label: id,
  centerLat: id === 'hssc' ? HSSC.lat : NSC.lat,
  centerLng: id === 'hssc' ? HSSC.lng : NSC.lng,
  defaultZoom: 15.8,
  defaultTilt: 0,
  defaultBearing: 0,
  ...over,
});

const CAMPUSES = [campus('hssc'), campus('nsc')];

/** Metres north of a point, near enough at these latitudes. */
const northOf = (at: LatLng, metres: number): LatLng => ({ lat: at.lat + metres / 111_320, lng: at.lng });

/** A stop 1.3 km south of the HSSC centre: outside the campus radius. */
const OFF_CAMPUS_STOP: LatLng = northOf(HSSC, -1300);
/** Gangnam, far from everything the app serves. */
const GANGNAM: LatLng = { lat: 37.4979, lng: 127.0276 };

describe('decideLaunchCamera', () => {
  it('starts on the selected campus without a location fix', () => {
    // Act
    const decision = decideLaunchCamera({ fix: null, campuses: CAMPUSES, nearby: NO_NEARBY });

    // Assert
    expect(decision).toEqual({ kind: 'campus' });
  });

  it('starts at a user inside a campus, and names that campus', () => {
    // Arrange
    const fix = northOf(NSC, DEFAULT_CAMPUS_RADIUS_M - 100);

    // Act
    const decision = decideLaunchCamera({ fix, campuses: CAMPUSES, nearby: null });

    // Assert
    expect(decision).toEqual({ kind: 'user', at: fix, campus: 'nsc' });
  });

  it('reads the served radius over the fallback', () => {
    // Arrange
    const fix = northOf(HSSC, 1500);

    // Act
    const decision = decideLaunchCamera({ fix, campuses: [campus('hssc', { radiusM: 2000 }), campus('nsc')], nearby: NO_NEARBY });

    // Assert
    expect(decision).toEqual({ kind: 'user', at: fix, campus: 'hssc' });
  });

  it('starts at a user near a served stop, with no campus to name', () => {
    // Arrange
    const fix = northOf(OFF_CAMPUS_STOP, -(NEAR_SERVED_PLACE_M - 100));

    // Act
    const decision = decideLaunchCamera({ fix, campuses: CAMPUSES, nearby: { stops: [OFF_CAMPUS_STOP], stations: [] } });

    // Assert
    expect(decision).toEqual({ kind: 'user', at: fix, campus: null });
  });

  it('starts at a user near a served station', () => {
    // Arrange
    const fix = northOf(OFF_CAMPUS_STOP, 200);

    // Act
    const decision = decideLaunchCamera({ fix, campuses: CAMPUSES, nearby: { stops: [], stations: [OFF_CAMPUS_STOP] } });

    // Assert
    expect(decision).toEqual({ kind: 'user', at: fix, campus: null });
  });

  it('starts on the selected campus for a user far from everything served', () => {
    // Act
    const decision = decideLaunchCamera({ fix: GANGNAM, campuses: CAMPUSES, nearby: { stops: [OFF_CAMPUS_STOP], stations: [] } });

    // Assert
    expect(decision).toEqual({ kind: 'campus' });
  });

  it('starts on the selected campus for a user just beyond a stop', () => {
    // Act
    const decision = decideLaunchCamera({
      fix: northOf(OFF_CAMPUS_STOP, -(NEAR_SERVED_PLACE_M + 100)),
      campuses: CAMPUSES,
      nearby: { stops: [OFF_CAMPUS_STOP], stations: [] },
    });

    // Assert
    expect(decision).toEqual({ kind: 'campus' });
  });

  it('waits for the served places when a user outside every campus could still be near one', () => {
    // Act
    const decision = decideLaunchCamera({ fix: GANGNAM, campuses: CAMPUSES, nearby: null });

    // Assert
    expect(decision).toEqual({ kind: 'wait' });
  });
});

describe('launchNearbyOf: the served places the launch waits for', () => {
  /** 강남역 as `GET /subway/stations` serves it (production, 2026-10-24). */
  const GANGNAM_STATION: LatLng = { lat: 37.497414, lng: 127.028008 };

  it('waits while either list has not answered and the wait has not run out', () => {
    // Act & Assert
    expect(launchNearbyOf({ stops: undefined, stations: [GANGNAM_STATION], waited: false })).toBeNull();
    expect(launchNearbyOf({ stops: [OFF_CAMPUS_STOP], stations: undefined, waited: false })).toBeNull();
  });

  it('takes both lists once both have answered', () => {
    // Act & Assert
    expect(launchNearbyOf({ stops: [OFF_CAMPUS_STOP], stations: [GANGNAM_STATION], waited: false })).toEqual({
      stops: [OFF_CAMPUS_STOP],
      stations: [GANGNAM_STATION],
    });
  });

  it('takes what has answered once the wait runs out, the rest as none', () => {
    // Act & Assert
    expect(launchNearbyOf({ stops: [OFF_CAMPUS_STOP], stations: undefined, waited: true })).toEqual({
      stops: [OFF_CAMPUS_STOP],
      stations: [],
    });
    expect(launchNearbyOf({ stops: undefined, stations: undefined, waited: true })).toEqual(NO_NEARBY);
  });

  it('starts at a user beside a served station, far from any campus and stop', () => {
    // Arrange
    const fix = northOf(GANGNAM_STATION, 400);
    const nearby = launchNearbyOf({ stops: [OFF_CAMPUS_STOP], stations: [GANGNAM_STATION], waited: false });

    // Act & Assert
    expect(decideLaunchCamera({ fix, campuses: CAMPUSES, nearby })).toEqual({ kind: 'user', at: fix, campus: null });
  });
});

describe('launchCameraOf', () => {
  it('centres the user at the framing of the campus they are inside, as a jump', () => {
    // Arrange
    const fix = northOf(NSC, 300);

    // Act
    const camera = launchCameraOf(
      { kind: 'user', at: fix, campus: 'nsc' },
      [campus('hssc'), campus('nsc', { defaultZoom: 16.2, defaultBearing: 30 })],
      'hssc',
    );

    // Assert
    expect(camera).toEqual({ lat: fix.lat, lng: fix.lng, zoom: 16.2, tilt: 0, bearing: 30, durationMs: 0 });
  });

  it('takes the selected campus framing for a user near a stop', () => {
    // Act
    const camera = launchCameraOf(
      { kind: 'user', at: OFF_CAMPUS_STOP, campus: null },
      [campus('hssc', { defaultZoom: 15.5 }), campus('nsc')],
      'hssc',
    );

    // Assert
    expect(camera).toEqual({ lat: OFF_CAMPUS_STOP.lat, lng: OFF_CAMPUS_STOP.lng, zoom: 15.5, tilt: 0, bearing: 0, durationMs: 0 });
  });
});

describe('campusToFollowAtLaunch', () => {
  it('follows a user who starts inside the other campus', () => {
    // Act
    const campus = campusToFollowAtLaunch({ kind: 'user', at: NSC, campus: 'nsc' }, 'hssc');

    // Assert
    expect(campus).toBe('nsc');
  });

  it('changes nothing for a user inside the selected campus', () => {
    // Act
    const campus = campusToFollowAtLaunch({ kind: 'user', at: HSSC, campus: 'hssc' }, 'hssc');

    // Assert
    expect(campus).toBe(null);
  });

  it('changes nothing for a user near a stop, whom no campus contains', () => {
    // Act
    const campus = campusToFollowAtLaunch({ kind: 'user', at: OFF_CAMPUS_STOP, campus: null }, 'nsc');

    // Assert
    expect(campus).toBe(null);
  });

  it('changes nothing when the camera starts on the campus', () => {
    // Act
    const campus = campusToFollowAtLaunch({ kind: 'campus' }, 'nsc');

    // Assert
    expect(campus).toBe(null);
  });
});

describe('the map tab opening around the launch camera (ADR 0022 d8)', () => {
  const config = parseOrThrow(mapConfigSchema, configProduction.data, 'map.config');
  const buildingLayers = config.layers.filter(
    (l) => l.endpoint === '/map/overlays/campus' && l.defaultVisibleWhen?.kind === 'always',
  );

  it.each(config.campuses.map((c) => [c.id, c] as const))(
    'draws the production building layers around a user inside %s',
    (_id, inside) => {
      // Arrange
      const at = { lat: inside.centerLat, lng: inside.centerLng };

      // Act
      const { zoom } = launchCameraOf({ kind: 'user', at, campus: inside.id }, config.campuses, 'hssc');

      // Assert
      expect(buildingLayers.length).toBeGreaterThan(0);
      for (const layer of buildingLayers) expect(zoom).toBeGreaterThanOrEqual(layer.style?.minZoom ?? 0);
    },
  );

  it.each(config.campuses.map((c) => [c.id] as const))(
    'draws them around a user near a stop with %s selected',
    (selected) => {
      // Act
      const { zoom } = launchCameraOf({ kind: 'user', at: OFF_CAMPUS_STOP, campus: null }, config.campuses, selected);

      // Assert
      for (const layer of buildingLayers) expect(zoom).toBeGreaterThanOrEqual(layer.style?.minZoom ?? 0);
    },
  );
});
