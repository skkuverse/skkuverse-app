/**
 * WHY: free of React and the map SDK, so the decision tests against real campus coordinates.
 * SEE: docs/decisions/0008-campus-camera-reconciliation.md ("Consequences")
 */

import type { Campus } from '@skkuverse/shared';
import type { CampusDef } from './map-config.types';
import { DEFAULT_CAMPUS_RADIUS_M } from './map.constants';
import type { CampusSuggestion } from './campus-proximity.types';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** WHY: haversine, since this also ranks a camera hundreds of kilometres away and runs once per settle. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

interface ResolveArgs {
  cameraLat: number;
  cameraLng: number;
  campuses: CampusDef[];
  selectedCampus: Campus;
}

/**
 * WHY: outside every campus, `show` may name the selected campus: the toggle stays and the camera comes back,
 * which is the way home from far away.
 */
export function resolveCampusSuggestion({
  cameraLat,
  cameraLng,
  campuses,
  selectedCampus,
}: ResolveArgs): CampusSuggestion | null {
  if (campuses.length === 0) return null;

  let nearest: CampusDef | null = null;
  let nearestDistance = Infinity;
  let inside: CampusDef | null = null;

  for (const campus of campuses) {
    const distance = distanceMeters(
      cameraLat,
      cameraLng,
      campus.centerLat,
      campus.centerLng,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = campus;
    }
    // WHY: the radii cannot overlap (`DEFAULT_CAMPUS_RADIUS_M`), so the first match is the only match.
    if (inside === null && distance <= (campus.radiusM ?? DEFAULT_CAMPUS_RADIUS_M)) {
      inside = campus;
    }
  }

  if (inside !== null) {
    if (inside.id === selectedCampus) return null;
    return { campus: inside.id, label: inside.label, variant: 'switch' };
  }

  if (nearest === null) return null;
  return { campus: nearest.id, label: nearest.label, variant: 'show' };
}
