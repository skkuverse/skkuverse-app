/**
 * WHY: what the map shows follows its zoom, not the sheet's detent; zoomed out, a line's stops draw as dots.
 * Both shapes hang by their centre, so a switch leaves the marker on its coordinate.
 */

import { BUS_STOP_DOT, LABEL_BOX, ROUTE_STOP_DOT, DEFAULT_LABEL_GAP } from './marker.constants';
import { STOP_PIN_MIN_ZOOM } from '../../camera.constants';

export type StopMarkerShape = 'dot' | 'pin';

export function stopMarkerShapeAt(zoom: number): StopMarkerShape {
  return zoom < STOP_PIN_MIN_ZOOM ? 'dot' : 'pin';
}

/** WHY: one object, so the marker's anchor prop keeps its identity. */
const CENTRE = { x: 0.5, y: 0.5 } as const;

export interface StopMarkerLook {
  image: 'routeStopDot' | 'stopPin';
  /** WHY: the canvas is the tap target. */
  size: number;
  markRadius: number;
  anchor: typeof CENTRE;
  tint: 'route' | 'stop';
  captioned: boolean;
}

const DOT_LOOK: StopMarkerLook = {
  image: 'routeStopDot',
  size: ROUTE_STOP_DOT.canvas,
  markRadius: ROUTE_STOP_DOT.disc / 2,
  anchor: CENTRE,
  tint: 'route',
  captioned: false,
};
const PIN_LOOK: StopMarkerLook = {
  image: 'stopPin',
  size: BUS_STOP_DOT.canvas,
  markRadius: BUS_STOP_DOT.disc / 2,
  anchor: CENTRE,
  // WHY: not the route's colour: a pin in the default `bg.dataBrand` would vanish on a route drawn in it.
  tint: 'stop',
  captioned: true,
};

export function stopMarkerLook(shape: StopMarkerShape): StopMarkerLook {
  return shape === 'dot' ? DOT_LOOK : PIN_LOOK;
}

/**
 * QUIRK(naver-map): past 1, the SDK hangs the image above its coordinate by that many of its own heights.
 * The default gap's anchors are built once, so the marker prop keeps its identity.
 */
function labelAnchorOf(shape: StopMarkerShape, gap: number) {
  return { x: 0.5, y: 1 + (stopMarkerLook(shape).markRadius + gap) / LABEL_BOX.height } as const;
}
const LABEL_ANCHORS = { dot: labelAnchorOf('dot', DEFAULT_LABEL_GAP), pin: labelAnchorOf('pin', DEFAULT_LABEL_GAP) } as const;

export function directionLabelAnchor(shape: StopMarkerShape, gap = DEFAULT_LABEL_GAP): { x: number; y: number } {
  return gap === DEFAULT_LABEL_GAP ? LABEL_ANCHORS[shape] : labelAnchorOf(shape, gap);
}
/** WHY: a Hangul syllable is 2 columns, about one em. */
export function directionLabelWidth(columns: number): number {
  return (columns * LABEL_BOX.textSize) / 2 + 2 * LABEL_BOX.paddingX;
}
