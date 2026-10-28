/**
 * How a line's stop draws at the camera's zoom: a small dot in the route's
 * colour when zoomed out, the captioned stop pin when zoomed in.
 */

import { describe, expect, it } from 'vitest';
import { BUS_STOP_DOT, LABEL_BOX, ROUTE_STOP_DOT } from './marker.constants';
import { directionLabelAnchor, directionLabelWidth, stopMarkerLook, stopMarkerShapeAt } from './task-marker.rules';
import { STOP_PIN_MIN_ZOOM } from '../../camera.constants';

describe('stopMarkerShapeAt: a dot below the threshold, the pin from it up', () => {
  it('is a dot just below the threshold', () => {
    expect(stopMarkerShapeAt(STOP_PIN_MIN_ZOOM - 0.01)).toBe('dot');
  });

  it('is the pin exactly at the threshold', () => {
    expect(stopMarkerShapeAt(STOP_PIN_MIN_ZOOM)).toBe('pin');
  });

  it('is the pin just above the threshold', () => {
    expect(stopMarkerShapeAt(STOP_PIN_MIN_ZOOM + 0.01)).toBe('pin');
  });

  it('puts the 17 Pro fits on the sides the owner chose: 07 at 55% dots, 08 at 30% pins, HSSC pins', () => {
    expect(STOP_PIN_MIN_ZOOM).toBe(13.4);
    expect(stopMarkerShapeAt(13.29)).toBe('dot');
    expect(stopMarkerShapeAt(13.46)).toBe('pin');
    expect(stopMarkerShapeAt(14.28)).toBe('pin');
  });
});

describe('stopMarkerLook: what the overlay draws for each shape', () => {
  it('draws a dot in the route colour with no caption, on a canvas at least 32 pt across for the thumb', () => {
    const look = stopMarkerLook('dot');
    expect(look).toEqual({
      image: 'routeStopDot',
      size: ROUTE_STOP_DOT.canvas,
      markRadius: ROUTE_STOP_DOT.disc / 2,
      anchor: { x: 0.5, y: 0.5 },
      tint: 'route',
      captioned: false,
    });
    expect(look.size).toBeGreaterThanOrEqual(32);
  });

  it('draws the stop pin in the stop colour with its caption', () => {
    expect(stopMarkerLook('pin')).toEqual({
      image: 'stopPin',
      size: BUS_STOP_DOT.canvas,
      markRadius: BUS_STOP_DOT.disc / 2,
      anchor: { x: 0.5, y: 0.5 },
      tint: 'stop',
      captioned: true,
    });
  });

  it('hangs both by their centre, so the marker stays on its coordinate when the shape switches', () => {
    expect(stopMarkerLook('dot').anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(stopMarkerLook('pin').anchor).toBe(stopMarkerLook('dot').anchor);
  });

  it('draws the dot about 8 pt with a 1.5 pt white ring, as the route stop dots on Naver Map do', () => {
    expect(ROUTE_STOP_DOT).toMatchObject({ disc: 8, ring: 1.5 });
  });
});

describe('directionLabelAnchor: the 방면 box floats just above the stop it is placed on, whatever its shape', () => {
  /** How far the box's bottom edge sits above the coordinate, for an anchor. */
  const bottomAbovePoint = (anchorY: number) => (anchorY - 1) * LABEL_BOX.height;

  it('floats the gap above the top of a pin', () => {
    expect(bottomAbovePoint(directionLabelAnchor('pin', 4).y)).toBeCloseTo(BUS_STOP_DOT.disc / 2 + 4);
  });

  it("floats the gap above the top of a dot, not the pin's", () => {
    expect(bottomAbovePoint(directionLabelAnchor('dot', 4).y)).toBeCloseTo(ROUTE_STOP_DOT.disc / 2 + 4);
  });

  it('defaults to a 4 pt gap', () => {
    expect(directionLabelAnchor('dot')).toEqual(directionLabelAnchor('dot', 4));
    expect(directionLabelAnchor('pin')).toEqual(directionLabelAnchor('pin', 4));
  });

  it('touches the mark at no gap, so the box never covers the stop it names', () => {
    expect(bottomAbovePoint(directionLabelAnchor('pin', 0).y)).toBeCloseTo(BUS_STOP_DOT.disc / 2);
    expect(bottomAbovePoint(directionLabelAnchor('dot', 0).y)).toBeCloseTo(ROUTE_STOP_DOT.disc / 2);
  });

  it('is centred across, and the same object for the same shape, so the marker prop keeps its identity', () => {
    expect(directionLabelAnchor('dot').x).toBe(0.5);
    expect(directionLabelAnchor('dot')).toBe(directionLabelAnchor('dot'));
  });
});

describe('directionLabelWidth', () => {
  it('is the two paddings around no text', () => {
    expect(directionLabelWidth(0)).toBe(2 * LABEL_BOX.paddingX);
  });

  it('grows by one em per Hangul syllable, two display columns', () => {
    expect(directionLabelWidth(2) - directionLabelWidth(0)).toBe(LABEL_BOX.textSize);
  });

  it('fits the reference label close to the baked width, so the stretch keeps the border at 1 pt', () => {
    // 이화사거리 방면: five syllables, a space, two syllables.
    const stretch = directionLabelWidth(15) / LABEL_BOX.bakedWidth;
    expect(stretch).toBeGreaterThan(0.9);
    expect(stretch).toBeLessThan(1.2);
  });
});
