/**
 * The marker shape axis: what a place marker draws, and where it hangs.
 *
 * The anchor is the half most easily got wrong, and it is why geometry is
 * resolved here rather than inline in the render loop: a teardrop hangs by its
 * tip and a disc by its centre, so swapping the image without swapping the
 * anchor slides the marker off the coordinate it is meant to be marking.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveMarkerGeometry,
} from './marker-shape.rules';
import { DOT_CANVAS_RATIO, DOT_DIAMETER, PIN_HEIGHT, PIN_WIDTH } from './marker.constants';

const LIVE = { width: 22, height: 30, captionTextSize: 9 };

describe('resolveMarkerGeometry — the default is dotThenPin', () => {
  it('draws a dot when nothing is selected and the server said nothing', () => {
    expect(resolveMarkerGeometry(undefined, false, undefined).kind).toBe('dot');
  });

  it('draws a pin for the selected marker', () => {
    expect(resolveMarkerGeometry(undefined, true, undefined).kind).toBe('pin');
  });

  it('treats an explicit dotThenPin the same as an absent shape', () => {
    for (const selected of [true, false]) {
      expect(resolveMarkerGeometry('dotThenPin', selected, LIVE)).toStrictEqual(resolveMarkerGeometry(undefined, selected, LIVE));
    }
  });
});

describe('resolveMarkerGeometry — pin and dot are unconditional', () => {
  it('keeps a pin layer a pin either way', () => {
    expect(resolveMarkerGeometry('pin', false, LIVE).kind).toBe('pin');
    expect(resolveMarkerGeometry('pin', true, LIVE).kind).toBe('pin');
  });

  it('keeps a dot layer a dot either way', () => {
    expect(resolveMarkerGeometry('dot', false, LIVE).kind).toBe('dot');
    expect(resolveMarkerGeometry('dot', true, LIVE).kind).toBe('dot');
  });
});

describe('resolveMarkerGeometry — the anchor follows the shape', () => {
  it('hangs a teardrop by its tip', () => {
    expect(resolveMarkerGeometry('pin', false, LIVE).anchorY).toBe(1);
  });

  it('hangs a disc by its centre', () => {
    expect(resolveMarkerGeometry('dot', false, LIVE).anchorY).toBe(0.5);
  });

  it('moves the anchor with the shape across a selection, not just the image', () => {
    const before = resolveMarkerGeometry('dotThenPin', false, LIVE);
    const after = resolveMarkerGeometry('dotThenPin', true, LIVE);
    expect(before.anchorY).toBe(0.5);
    expect(after.anchorY).toBe(1);
  });
});

describe('resolveMarkerGeometry — geometry comes off the wire, with the old constants as fallbacks', () => {
  it('sizes a pin from style.width/height', () => {
    const g = resolveMarkerGeometry('pin', false, { width: 40, height: 55 });
    expect([g.width, g.height]).toStrictEqual([40, 55]);
  });

  it('falls a pin back to the constants this file used to hardcode', () => {
    const g = resolveMarkerGeometry('pin', false, undefined);
    expect([g.width, g.height]).toStrictEqual([PIN_WIDTH, PIN_HEIGHT]);
  });

  it('pads the dot canvas so the tap target is bigger than the visible disc', () => {
    // The asset carries transparent padding; `size` names the VISIBLE diameter,
    // so the overlay has to be told the padded canvas or the disc renders small
    // inside a box that was never grown.
    const g = resolveMarkerGeometry('dot', false, { size: 18 });
    expect(g.width).toBe(18 * DOT_CANVAS_RATIO);
    expect(g.width).toBe(g.height);
    expect(g.width > 18, 'the canvas must exceed the visible disc').toBeTruthy();
  });

  it('falls the dot back to DOT_DIAMETER when the server sends no size', () => {
    const g = resolveMarkerGeometry('dot', false, LIVE);
    expect(g.width).toBe(DOT_DIAMETER * DOT_CANVAS_RATIO);
  });

  it('grows a selected dot to the pin width, so one wire field sizes both shapes', () => {
    const g = resolveMarkerGeometry('dot', true, LIVE);
    expect(g.width).toBe(LIVE.width * DOT_CANVAS_RATIO);
  });
});

describe('resolveMarkerGeometry — a selected marker is visibly bigger than an unselected one', () => {
  it('holds for dotThenPin', () => {
    const dot = resolveMarkerGeometry('dotThenPin', false, LIVE);
    const pin = resolveMarkerGeometry('dotThenPin', true, LIVE);
    // Compare the VISIBLE disc, not the padded canvas — the padding is a tap
    // target, not something the eye reads as size.
    expect(dot.width / DOT_CANVAS_RATIO < pin.width).toBeTruthy();
  });

  it('holds for dot', () => {
    expect(resolveMarkerGeometry('dot', false, LIVE).width <
        resolveMarkerGeometry('dot', true, LIVE).width).toBeTruthy();
  });
});
