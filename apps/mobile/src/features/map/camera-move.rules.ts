import type { MapChipCamera } from './map-config.types';
import type { MapCameraSnapshot } from './sheet-stack.types';
import type { LatLng } from '@skkuverse/shared';
import { ATTITUDE_TOLERANCE_DEG, POINT_SPAN_DEG, REPEAT_NUDGE_DEG } from './camera.constants';
import { NAVER_LOGO_MARGIN, NAVER_LOGO_SIDE_MARGIN } from './sheet-detents.constants';
/**
 * QUIRK(naver-map): `animateCameraTo` carries no tilt or bearing and the `camera` prop no duration, so the
 * question is whether the attitude must change; testing the target against zero flies a rotated map to a
 * bearing-0 target still rotated. Two callbacks, not a ref, so it tests under plain Node.
 */


export interface CameraAnimateArg {
  latitude: number;
  longitude: number;
  zoom: number;
  duration: number;
}

export interface CameraCommandArg {
  latitude: number;
  longitude: number;
  zoom: number;
  tilt: number;
  bearing: number;
}

export interface CameraAttitude {
  tilt?: number;
  bearing?: number;
}

export interface MoveCameraHandlers {
  /**
   * WHY: `null` is unknown, not flat: the map is still at its `initialCamera`, whose campus may be rotated,
   * so an unknown attitude takes the prop path at the cost of one move's duration.
   */
  current: CameraAttitude | null;
  animate: (arg: CameraAnimateArg) => void;
  command: (arg: CameraCommandArg) => void;
}

function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function moveCamera(
  target: MapChipCamera,
  { current, animate, command }: MoveCameraHandlers,
): void {
  const { lat, lng, zoom, tilt, bearing, durationMs } = target;

  const attitudeHolds =
    current !== null &&
    Math.abs((current.tilt ?? 0) - tilt) < ATTITUDE_TOLERANCE_DEG &&
    angleBetween(current.bearing ?? 0, bearing) < ATTITUDE_TOLERANCE_DEG;

  if (attitudeHolds) {
    animate({ latitude: lat, longitude: lng, zoom, duration: durationMs });
    return;
  }

  command({ latitude: lat, longitude: lng, zoom, tilt, bearing });
}

export interface CameraOrder {
  latitude: number;
  longitude: number;
  zoom?: number;
  tilt?: number;
  bearing?: number;
}

/**
 * QUIRK(naver-map): the native side applies the prop only when it differs by value from the last order,
 * not from where the map is, so a repeated order is dropped silently. A repeat is nudged: T, T+ε, T, …
 */
export function distinctCommand<T extends CameraOrder>(prev: CameraOrder | undefined, next: T): T {
  const repeats =
    prev !== undefined &&
    prev.latitude === next.latitude &&
    prev.longitude === next.longitude &&
    prev.zoom === next.zoom &&
    prev.tilt === next.tilt &&
    prev.bearing === next.bearing;
  return repeats ? { ...next, latitude: next.latitude + REPEAT_NUDGE_DEG } : next;
}

export interface ReportedCamera {
  latitude: number;
  longitude: number;
  zoom?: number;
  tilt?: number;
  bearing?: number;
}

/** WHY: null for a settle with no zoom, since restoring a guessed zoom moves the map somewhere never framed. */
export function cameraSnapshotOf(camera: ReportedCamera): MapCameraSnapshot | null {
  if (camera.zoom === undefined) return null;
  return {
    latitude: camera.latitude,
    longitude: camera.longitude,
    zoom: camera.zoom,
    tilt: camera.tilt ?? 0,
    bearing: camera.bearing ?? 0,
  };
}

export type MapFrame = { kind: 'bounds'; sw: LatLng; ne: LatLng } | { kind: 'point'; lat: number; lng: number };

/** WHY: a cluster no wider than `POINT_SPAN_DEG` folds to one point, which fit-bounds would zoom into the pavement on. */
export function frameOf(points: readonly (LatLng | null)[]): MapFrame | null {
  const present = points.filter((p): p is LatLng => p !== null);
  if (present.length === 0) return null;
  const lats = present.map((p) => p.lat);
  const lngs = present.map((p) => p.lng);
  const sw = { lat: Math.min(...lats), lng: Math.min(...lngs) };
  const ne = { lat: Math.max(...lats), lng: Math.max(...lngs) };
  if (ne.lat - sw.lat <= POINT_SPAN_DEG && ne.lng - sw.lng <= POINT_SPAN_DEG) {
    return { kind: 'point', lat: (sw.lat + ne.lat) / 2, lng: (sw.lng + ne.lng) / 2 };
  }
  return { kind: 'bounds', sw, ne };
}

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FrameMargins {
  top: number;
  bottom: number;
  side: number;
}

/**
 * WHY: the band has a floor, `minBand`: below it the sheet is dropped and the tab bar alone pads the bottom,
 * so the SDK never gets an empty content area (ADR 0022 §3).
 */
export function visibleMapPadding(input: {
  controlsBottom: number;
  sheetRest: number;
  tabBarInset: number;
  margins: FrameMargins;
  containerHeight: number;
  minBand: number;
}): MapPadding {
  const { controlsBottom, sheetRest, tabBarInset, margins, containerHeight, minBand } = input;
  const top = controlsBottom + margins.top;
  const withSheet = Math.max(sheetRest, tabBarInset) + margins.bottom;
  const band = containerHeight - top - withSheet;
  return {
    top,
    bottom: band >= minBand ? withSheet : tabBarInset + margins.bottom,
    left: margins.side,
    right: margins.side,
  };
}

/**
 * QUIRK(naver-map): the SDK lays the logo out inside its content padding (iOS floors the margin at 9 pt top
 * and bottom, 12 pt at the sides), so the top lifts to `logoTop` and the bottom lowers as much, keeping the
 * band's centre; a fit-bounds widens to match (`boundsForPadding`).
 */
export function sdkMapPadding(band: MapPadding, { logoTop }: { logoTop: number }): MapPadding {
  const lift = Math.min(Math.max(0, band.top - Math.max(0, logoTop)), band.bottom);
  const side = Math.min(band.left, band.right);
  return {
    top: band.top - lift,
    bottom: band.bottom - lift,
    left: band.left - side,
    right: band.right - side,
  };
}

export interface LogoMargin {
  top: number;
  left: number;
}

/**
 * WHY: NAVER's terms forbid covering the logo, and with no padding it sits behind the campus toggle or the
 * sheet. The side is the SDK's iOS floor, spelled out because Android takes the margin as given.
 */
export function logoMarginOf(sdkPadding: MapPadding | undefined, { logoTop }: { logoTop: number }): LogoMargin | undefined {
  if (sdkPadding) return undefined;
  return { top: Math.max(0, logoTop) + NAVER_LOGO_MARGIN, left: NAVER_LOGO_SIDE_MARGIN };
}

export interface FrameBounds {
  sw: LatLng;
  ne: LatLng;
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfMercatorY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * QUIRK(naver-map): each axis widens about its centre by the content's growth, latitude in Mercator as the SDK
 * projects, so the fit lands where fitting into the band would.
 */
export function boundsForPadding(
  bounds: FrameBounds,
  { band, padding, size }: { band: MapPadding; padding: MapPadding; size: { width: number; height: number } },
): FrameBounds {
  const bandW = size.width - band.left - band.right;
  const bandH = size.height - band.top - band.bottom;
  if (bandW <= 0 || bandH <= 0) return bounds;
  const growX = (size.width - padding.left - padding.right) / bandW;
  const growY = (size.height - padding.top - padding.bottom) / bandH;
  if (growX === 1 && growY === 1) return bounds;
  const midLng = (bounds.sw.lng + bounds.ne.lng) / 2;
  const halfLng = ((bounds.ne.lng - bounds.sw.lng) / 2) * growX;
  const southY = mercatorY(bounds.sw.lat);
  const northY = mercatorY(bounds.ne.lat);
  const midY = (southY + northY) / 2;
  const halfY = ((northY - southY) / 2) * growY;
  return {
    sw: { lat: latOfMercatorY(midY - halfY), lng: midLng - halfLng },
    ne: { lat: latOfMercatorY(midY + halfY), lng: midLng + halfLng },
  };
}

/**
 * EVIDENCE: measured on the simulator (2026-10-24): a 888 m box fitted to 129 pt at zoom 13.14 and a 705 m box
 * to 158 pt at 13.77, both half of Web Mercator with 256 pt tiles, so Naver's zoom runs one level deeper.
 * Only tests read it; the SDK picks the zoom at run time.
 */
export const NAVER_M_PER_PT_AT_ZOOM_0 = 62024;

export function metresPerPointAt(zoom: number): number {
  return NAVER_M_PER_PT_AT_ZOOM_0 / 2 ** zoom;
}

export function zoomToFit(spanM: { northSouth: number; eastWest: number }, band: { width: number; height: number }): number {
  const forHeight = Math.log2((NAVER_M_PER_PT_AT_ZOOM_0 * band.height) / spanM.northSouth);
  const forWidth = Math.log2((NAVER_M_PER_PT_AT_ZOOM_0 * band.width) / spanM.eastWest);
  return Math.min(forHeight, forWidth);
}
