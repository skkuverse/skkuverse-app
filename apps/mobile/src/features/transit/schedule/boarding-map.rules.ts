export interface LatLng {
  lat: number;
  lng: number;
}

export interface CardCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface CardMap {
  markers: readonly { id: string; label: string; coords: LatLng }[];
  paths: readonly { from: string; to: string; points: readonly LatLng[] }[];
}

export const STOP_END = 'stop';

/** WHY: the arrowhead stops short of the pin or exit circle at a walk's end; a walk whose end marker was dropped is drawn whole. */
export const ARROW_GAP_PT = { stop: 6, marker: 11 } as const;

const WORLD_PT = 512;
const EARTH_M_PER_PT_AT_ZOOM_0 = 78271.51696;

/** EVIDENCE: about 450 m across a phone's card at Seoul's latitude; all walks but Jamsil's (about 200 m) fit well inside. */
export const MAX_CARD_ZOOM = 15.5;

function toWorld({ lat, lng }: LatLng): { x: number; y: number } {
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function fromWorld(x: number, y: number): LatLng {
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return { lat, lng };
}

/**
 * EVIDENCE: NAVER Map's world is 512·2^z pt wide, not the 256 pt web maps': a 109 m walk spanned 156 pt at
 * zoom 16.5 on the iOS simulator (0.70 m/pt against this formula's 0.67).
 */
export function metersPerPoint(lat: number, zoom: number): number {
  return (EARTH_M_PER_PT_AT_ZOOM_0 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** WHY: computed here, not by the SDK's fit-bounds, because the path trim needs the zoom before the map exists. */
export function fitCamera(
  points: readonly LatLng[],
  width: number,
  height: number,
  padding: number,
): CardCamera {
  const world = points.map(toWorld);
  const xs = world.map((p) => p.x);
  const ys = world.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = (maxX - minX) * WORLD_PT;
  const spanY = (maxY - minY) * WORLD_PT;
  const fitX = spanX > 0 ? Math.log2(Math.max(width - 2 * padding, 1) / spanX) : Infinity;
  const fitY = spanY > 0 ? Math.log2(Math.max(height - 2 * padding, 1) / spanY) : Infinity;
  const zoom = Math.min(fitX, fitY, MAX_CARD_ZOOM);

  const center = fromWorld((minX + maxX) / 2, (minY + maxY) / 2);
  return { latitude: center.lat, longitude: center.lng, zoom };
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * R;
}

/** WHY: never cuts more than half the path, so a very short walk's arrow still points somewhere. */
export function trimPathEnd(path: readonly LatLng[], meters: number): LatLng[] {
  if (path.length < 2 || meters <= 0) return [...path];
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  let remaining = Math.min(meters, total / 2);

  const out = [...path];
  while (out.length >= 2 && remaining > 0) {
    const end = out[out.length - 1];
    const prev = out[out.length - 2];
    const seg = distanceMeters(prev, end);
    if (seg > remaining) {
      const t = (seg - remaining) / seg;
      out[out.length - 1] = {
        lat: prev.lat + (end.lat - prev.lat) * t,
        lng: prev.lng + (end.lng - prev.lng) * t,
      };
      remaining = 0;
    } else {
      out.pop();
      remaining -= seg;
    }
  }
  return out.length >= 2 ? out : [...path];
}

export function cardPoints(stop: LatLng, map: CardMap): LatLng[] {
  return [stop, ...map.markers.map((m) => m.coords), ...map.paths.flatMap((p) => p.points)];
}

export function arrowGapPt(to: string, map: CardMap): number {
  if (to === STOP_END) return ARROW_GAP_PT.stop;
  return map.markers.some((m) => m.id === to) ? ARROW_GAP_PT.marker : 0;
}

export function describeMap(stopName: string, map: CardMap): string {
  const labelOf = (id: string) =>
    id === STOP_END ? stopName : map.markers.find((m) => m.id === id)?.label;
  const walks = map.paths.flatMap((p) => {
    const from = labelOf(p.from);
    const to = labelOf(p.to);
    return from && to ? [`${from} → ${to}`] : [];
  });
  return walks.length > 0 ? walks.join(', ') : [stopName, ...map.markers.map((m) => m.label)].join(', ');
}
