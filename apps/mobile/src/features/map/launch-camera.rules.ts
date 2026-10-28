/**
 * WHY: "near" is a campus radius or a served place, never the fix alone, since a user at home would see their
 * neighbourhood with nothing of ours on it (ADR 0022 d1). Applied once, at a cold start.
 */

import type { Campus, LatLng } from '@skkuverse/shared';
import { distanceMeters } from './campus-proximity.rules';
import type { CampusDef, MapChipCamera } from './map-config.types';
import { NEAR_SERVED_PLACE_M } from './camera.constants';
import { DEFAULT_CAMPUS_RADIUS_M, FALLBACK_CAMPUS } from './map.constants';

export interface LaunchNearby {
  stops: readonly LatLng[];
  stations: readonly LatLng[];
}

export const NO_NEARBY: LaunchNearby = { stops: [], stations: [] };

/** WHY: a list that never answers costs only the near-a-place start it would have allowed. */
export function launchNearbyOf({
  stops,
  stations,
  waited,
}: {
  stops: readonly LatLng[] | undefined;
  stations: readonly LatLng[] | undefined;
  waited: boolean;
}): LaunchNearby | null {
  if ((!stops || !stations) && !waited) return null;
  return { stops: stops ?? [], stations: stations ?? [] };
}

export type LaunchCamera =
  | { kind: 'user'; at: LatLng; campus: Campus | null }
  | { kind: 'campus' };

export type LaunchDecision = LaunchCamera | { kind: 'wait' };

interface DecideLaunchInputs {
  fix: LatLng | null;
  campuses: readonly CampusDef[];
  nearby: LaunchNearby | null;
}

export function decideLaunchCamera({ fix, campuses, nearby }: DecideLaunchInputs): LaunchDecision {
  if (!fix) return { kind: 'campus' };
  const inside = campuses.find(
    (c) => distanceMeters(fix.lat, fix.lng, c.centerLat, c.centerLng) <= (c.radiusM ?? DEFAULT_CAMPUS_RADIUS_M),
  );
  if (inside) return { kind: 'user', at: fix, campus: inside.id };
  if (!nearby) return { kind: 'wait' };
  const near = [...nearby.stops, ...nearby.stations].some(
    (p) => distanceMeters(fix.lat, fix.lng, p.lat, p.lng) <= NEAR_SERVED_PLACE_M,
  );
  return near ? { kind: 'user', at: fix, campus: null } : { kind: 'campus' };
}

/**
 * WHY: the campus's framing, so the user lands on the buildings around them; a jump, since nothing is drawn yet
 * (ADR 0022 d8).
 */
export function launchCameraOf(
  launch: Extract<LaunchCamera, { kind: 'user' }>,
  campuses: readonly CampusDef[],
  selectedCampus: Campus,
): MapChipCamera {
  const framing = campuses.find((c) => c.id === (launch.campus ?? selectedCampus)) ?? campuses[0];
  return {
    lat: launch.at.lat,
    lng: launch.at.lng,
    zoom: framing?.defaultZoom ?? FALLBACK_CAMPUS.defaultZoom,
    tilt: framing?.defaultTilt ?? 0,
    bearing: framing?.defaultBearing ?? 0,
    durationMs: 0,
  };
}

/**
 * WHY: the one time the app moves the selection, so the map and the transit list agree from the start
 * (ADR 0022 d5); during use only the user does.
 */
export function campusToFollowAtLaunch(launch: LaunchCamera, selectedCampus: Campus): Campus | null {
  if (launch.kind !== 'user' || launch.campus === null || launch.campus === selectedCampus) return null;
  return launch.campus;
}
