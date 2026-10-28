import type { Campus, LatLng } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import { overlayAnchor } from './geometry.rules';
import { DEFAULT_CAMERA_DEFAULTS, FALLBACK_CAMPUS } from './map.constants';
import type { CampusDef, MapCameraMotion, MapChipCamera, MapConfig } from './map-config.types';
import type { MapOverlay } from './overlay.types';
import type { MapCameraSnapshot } from './sheet-stack.types';

/**
 * WHY: tilt and bearing belong to the campus, since the natural sciences campus is rotated; the global
 * bearing would swing the map back to north on every pin tap.
 */
export function markerFocusOn(config: MapConfig | null, campusId: Campus): MapCameraMotion {
  const defaults = config?.cameraDefaults ?? DEFAULT_CAMERA_DEFAULTS;
  const campus = config?.campuses.find((c) => c.id === campusId);
  return campus
    ? { ...defaults.markerFocus, tilt: campus.defaultTilt, bearing: campus.defaultBearing }
    : defaults.markerFocus;
}

/**
 * WHY: every way in moves the camera but a pin, which the user tapped where they can see it (ADR 0022 d5);
 * a building at (0, 0) is the server's no-coordinate and moves nothing.
 */
export function toBuildingCamera(
  building: { lat: number; lng: number; campus: Campus },
  source: EntrySource,
  config: MapConfig | null,
): MapChipCamera | null {
  if (source === 'pin' || (building.lat === 0 && building.lng === 0)) return null;
  return { lat: building.lat, lng: building.lng, ...markerFocusOn(config, building.campus) };
}

/** WHY: `overlayAnchor`, not `lat`: a zone has no single coordinate. */
export function toPlaceCamera(config: MapConfig | null, place: MapOverlay): MapChipCamera {
  return { ...overlayAnchor(place), ...markerFocusOn(config, place.campus) };
}

export function toCampusCamera(campus: CampusDef, durationMs: number): MapChipCamera {
  return {
    lat: campus.centerLat,
    lng: campus.centerLng,
    zoom: campus.defaultZoom,
    tilt: campus.defaultTilt,
    bearing: campus.defaultBearing,
    durationMs,
  };
}

export function toPointCamera(point: LatLng, markerFocus: MapCameraMotion): MapChipCamera {
  return { ...markerFocus, lat: point.lat, lng: point.lng, durationMs: 0 };
}

/** WHY: no animation: a restore puts the map back, it does not fly. */
export function toRestoreCamera(snapshot: MapCameraSnapshot): MapChipCamera {
  return {
    lat: snapshot.latitude,
    lng: snapshot.longitude,
    zoom: snapshot.zoom,
    tilt: snapshot.tilt,
    bearing: snapshot.bearing,
    durationMs: 0,
  };
}

export function toInitialCamera(
  campuses: readonly CampusDef[],
  selected: Campus,
): { latitude: number; longitude: number; zoom: number; tilt: number; bearing: number } {
  const campus = campuses.find((c) => c.id === selected) ?? campuses[0] ?? FALLBACK_CAMPUS;
  return {
    latitude: campus.centerLat,
    longitude: campus.centerLng,
    zoom: campus.defaultZoom,
    tilt: campus.defaultTilt,
    bearing: campus.defaultBearing,
  };
}
