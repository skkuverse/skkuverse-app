/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §2.4 serves RFC 7946 verbatim.
 * WHY: the only place `[lng, lat]` is read; an axis swap never throws, it draws Seoul in the Yellow Sea, so
 * there is exactly one conversion. Ring winding is the renderer's (`overlay-geometry.rules.ts`).
 */

import type { LatLng } from '@skkuverse/shared';
import type { MapOverlay } from './overlay.types';

/**
 * WHY: `null`, never a default position, so the caller drops the overlay. `|lat| <= 90` is a tripwire for a
 * transposed pair; a third element (altitude) is ignored, as RFC 7946 allows.
 */
export function toLatLng(raw: unknown): LatLng | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw as unknown[];
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** WHY: null if any position is unreadable: a route missing a vertex is a different route. */
export function toLatLngs(raw: unknown, min: number): LatLng[] | null {
  if (!Array.isArray(raw) || raw.length < min) return null;
  const out: LatLng[] = [];
  for (const position of raw) {
    const point = toLatLng(position);
    if (point === null) return null;
    out.push(point);
  }
  return out;
}

/** WHY: the closing repeat is kept, since the SDK wants a closed ring; matches the server's `isDrawableGeometry`. */
export function toRings(raw: unknown): LatLng[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rings: LatLng[][] = [];
  for (const ring of raw) {
    const points = toLatLngs(ring, 4);
    if (points === null) return null;
    rings.push(points);
  }
  return rings;
}

/**
 * WHY: derived, never stored, so it cannot disagree with the geometry. A bounding-box centre, since a vertex
 * mean drifts toward the more detailed end and a ring's repeated first position.
 */
export function overlayAnchor(overlay: MapOverlay): LatLng {
  switch (overlay.kind) {
    case 'marker':
      return { lat: overlay.lat, lng: overlay.lng };
    case 'polygon':
      // WHY: the exterior ring alone; a hole cannot move where the zone is.
      return bboxCenter(overlay.rings[0] ?? []);
    case 'path':
      return bboxCenter(overlay.line);
  }
}

function bboxCenter(points: readonly LatLng[]): LatLng {
  // WHY: unreachable from the parser; Null Island rather than a throw keeps a hand-edited document from taking a
  // layer down.
  if (points.length === 0) return { lat: 0, lng: 0 };

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { lat, lng } of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
