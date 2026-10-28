/**
 * Camera mechanism choice.
 *
 * The Naver SDK splits a camera across two mechanisms and neither carries all
 * of it: `animateCameraTo` takes a coordinate, a zoom and a duration but can
 * NOT set tilt or bearing, while the declarative `camera` prop carries tilt and
 * bearing and has no duration.
 *
 * So the rule is not "is the target flat" — it is **does the attitude have to
 * change**. A flat target sent imperatively at a rotated map arrives still
 * rotated, silently, because the mechanism has no way to say "bearing 0". That
 * was the first version of this file and is what these tests exist to keep
 * fixed.
 */

import { describe, expect, it } from 'vitest';
import {
  boundsForPadding,
  cameraSnapshotOf,
  distinctCommand,
  frameOf,
  logoMarginOf,
  metresPerPointAt,
  moveCamera,
  sdkMapPadding,
  visibleMapPadding,
  zoomToFit,
} from './camera-move.rules';
import type { MapChipCamera } from './map-config.types';
import type { LatLng } from '@skkuverse/shared';
import { MID_PERCENT, NAVER_LOGO_MARGIN } from './sheet-detents.constants';
import { POINT_SPAN_DEG, MIN_VISIBLE_BAND } from './camera.constants';

const FLAT: MapChipCamera = {
  lat: 37.295129,
  lng: 126.971234,
  zoom: 17.5,
  tilt: 0,
  bearing: 0,
  durationMs: 500,
};

const spy = () => {
  const calls: unknown[] = [];
  return { calls, fn: (arg: unknown) => calls.push(arg) };
};

/** Runs a move and reports which mechanism took it. */
const run = (target: MapChipCamera, current: { tilt?: number; bearing?: number } | null) => {
  const animate = spy();
  const command = spy();
  moveCamera(target, { current, animate: animate.fn, command: command.fn });
  return { animate, command };
};

describe('moveCamera — the imperative path, when no attitude has to change', () => {
  it('animates a flat target at an already flat map, so it keeps its duration', () => {
    const { animate, command } = run(FLAT, { tilt: 0, bearing: 0 });
    expect(command.calls.length).toBe(0);
    expect(animate.calls[0]).toStrictEqual({
      latitude: 37.295129,
      longitude: 126.971234,
      zoom: 17.5,
      duration: 500,
    });
  });

  it('animates a TILTED target at a map already at that tilt', () => {
    // `animateCameraTo` cannot set tilt, but it does not clear it either — so
    // when the attitude is already right, the imperative path is both correct
    // and the one that honours durationMs.
    const { animate, command } = run({ ...FLAT, tilt: 45 }, { tilt: 45, bearing: 0 });
    expect(command.calls.length).toBe(0);
    expect(animate.calls.length).toBe(1);
  });

  it('reads a missing attitude member as 0 rather than as unknown', () => {
    const { animate } = run(FLAT, {});
    expect(animate.calls.length).toBe(1);
  });
});

describe('moveCamera — the prop path, when the attitude has to change', () => {
  it('un-rotates a rotated map for a bearing-0 target', () => {
    // THE BUG THIS FILE EXISTS FOR. The target is flat, so a "is the target
    // flat" test would send it imperatively and the map would stay rotated,
    // with no error on either side.
    const { animate, command } = run(FLAT, { tilt: 0, bearing: 45 });
    expect(animate.calls.length).toBe(0);
    expect(command.calls[0]).toStrictEqual({
      latitude: 37.295129,
      longitude: 126.971234,
      zoom: 17.5,
      tilt: 0,
      bearing: 0,
    });
  });

  it('un-tilts a tilted map for a tilt-0 target', () => {
    const { animate, command } = run(FLAT, { tilt: 40, bearing: 0 });
    expect(animate.calls.length).toBe(0);
    expect((command.calls[0] as { tilt: number }).tilt).toBe(0);
  });

  it('applies a tilt the map does not have', () => {
    const { animate, command } = run({ ...FLAT, tilt: 45 }, { tilt: 0, bearing: 0 });
    expect(animate.calls.length).toBe(0);
    expect((command.calls[0] as { tilt: number }).tilt).toBe(45);
  });

  it('commands a map that has not reported a camera, since its attitude is unknown', () => {
    // Nothing has settled yet, so the map is at its initial camera, which
    // carries the campus's bearing — not necessarily this target's. Only the
    // prop can guarantee the target's attitude from there.
    const { animate, command } = run(FLAT, null);
    expect(animate.calls.length).toBe(0);
    expect((command.calls[0] as { bearing: number }).bearing).toBe(0);
  });

  it('applies a bearing the map does not have', () => {
    const { animate, command } = run({ ...FLAT, bearing: 90 }, { tilt: 0, bearing: 0 });
    expect(animate.calls.length).toBe(0);
    expect((command.calls[0] as { bearing: number }).bearing).toBe(90);
  });
});

describe('distinctCommand — a repeated camera order is still delivered', () => {
  // The native side drops a `camera` prop equal by value to the previous one
  // (`RNCNaverMapView.mm:206`). A second tap on the 에스카라 chip sent exactly
  // that, and nothing moved.
  const ORDER = { latitude: 37.295129, longitude: 126.971234, zoom: 17.5, tilt: 0, bearing: 6 };

  it('passes the first order through', () => {
    expect(distinctCommand(undefined, ORDER)).toBe(ORDER);
  });

  it('passes a different order through unchanged', () => {
    const prev = { ...ORDER, bearing: 0 };
    expect(distinctCommand(prev, ORDER)).toBe(ORDER);
  });

  it('nudges an order that repeats the previous one, invisibly', () => {
    const next = distinctCommand({ ...ORDER }, ORDER);
    expect(next.latitude).not.toBe(ORDER.latitude);
    expect(Math.abs(next.latitude - ORDER.latitude) < 1e-8).toBeTruthy();
    expect({ ...next, latitude: ORDER.latitude }).toStrictEqual(ORDER);
  });

  it('never repeats the previous write across a run of identical taps', () => {
    let prev: typeof ORDER | undefined;
    for (let i = 0; i < 5; i++) {
      const next = distinctCommand(prev, ORDER);
      if (prev) expect(next).not.toStrictEqual(prev);
      prev = next;
    }
  });

  it('keeps the fields it does not compare', () => {
    const withExtra = { ...ORDER, reason: 'Developer' };
    expect(distinctCommand(ORDER, withExtra).reason).toBe('Developer');
  });
});

describe('moveCamera — attitude is compared within a tolerance', () => {
  const ROTATED: MapChipCamera = { ...FLAT, bearing: 6 };

  it('animates when the reported heading is 6 plus float noise', () => {
    // The SDK reports a heading set to 6 as 6.000000000000001.
    const { animate, command } = run(ROTATED, { tilt: 0, bearing: 6.000000000000001 });
    expect(command.calls.length).toBe(0);
    expect(animate.calls.length).toBe(1);
  });

  it('still commands a real change of heading', () => {
    const { animate, command } = run(ROTATED, { tilt: 0, bearing: 7 });
    expect(animate.calls.length).toBe(0);
    expect(command.calls.length).toBe(1);
  });

  it('treats headings either side of north as close', () => {
    const { animate, command } = run(FLAT, { tilt: 0, bearing: 359.999 });
    expect(command.calls.length).toBe(0);
    expect(animate.calls.length).toBe(1);
  });
});

describe('a remembered camera and its restore', () => {
  it('records what the map reported, with a flat attitude where it reported none', () => {
    // Act
    const snapshot = cameraSnapshotOf({ latitude: 37.58, longitude: 126.99, zoom: 16 });

    // Assert
    expect(snapshot).toEqual({ latitude: 37.58, longitude: 126.99, zoom: 16, tilt: 0, bearing: 0 });
  });

  it('records nothing for a settle that reported no zoom', () => {
    // Act
    const snapshot = cameraSnapshotOf({ latitude: 37.58, longitude: 126.99 });

    // Assert
    expect(snapshot).toBeNull();
  });
});

describe('frameOf: the frame that shows every point', () => {
  const HYEHWA: LatLng = { lat: 37.5834729904, lng: 127.0017632862 };
  const STADIUM: LatLng = { lat: 37.5906, lng: 126.9922 };

  it('is null without a point', () => {
    // Act & Assert
    expect(frameOf([])).toBeNull();
    expect(frameOf([null, null])).toBeNull();
  });

  it('is the bounds of a route, south-west to north-east, with a stop without coordinates ignored', () => {
    // Act
    const frame = frameOf([HYEHWA, null, STADIUM]);

    // Assert
    // The stadium is north-west of Hyehwa, so each corner takes one of each.
    expect(frame).toStrictEqual({
      kind: 'bounds',
      sw: { lat: HYEHWA.lat, lng: STADIUM.lng },
      ne: { lat: STADIUM.lat, lng: HYEHWA.lng },
    });
    expect(frame).toStrictEqual(frameOf([HYEHWA, STADIUM]));
  });

  it('is the one point for a lone stop, which fit-bounds would zoom onto the pavement', () => {
    // Act & Assert
    expect(frameOf([HYEHWA])).toStrictEqual({ kind: 'point', lat: HYEHWA.lat, lng: HYEHWA.lng });
  });

  it('is the centre point of a cluster no wider than the point span, and bounds once it is wider', () => {
    // Arrange
    const near = { lat: HYEHWA.lat + POINT_SPAN_DEG * 0.9, lng: HYEHWA.lng + POINT_SPAN_DEG * 0.9 };
    const wide = { lat: HYEHWA.lat + POINT_SPAN_DEG * 1.01, lng: HYEHWA.lng };

    // Act & Assert
    expect(frameOf([HYEHWA, near])).toStrictEqual({
      kind: 'point',
      lat: (HYEHWA.lat + near.lat) / 2,
      lng: (HYEHWA.lng + near.lng) / 2,
    });
    expect(frameOf([HYEHWA, wide])).toMatchObject({ kind: 'bounds' });
  });
});

describe('visibleMapPadding: the content padding that makes the camera the visible map', () => {
  const TALL = { containerHeight: 1000, minBand: 120 };
  const ALL_32 = { top: 32, bottom: 32, side: 32 };

  it('pads the top and the bottom by the detent’s own margins, the sides by the frame margin', () => {
    const tight = visibleMapPadding({ controlsBottom: 122, sheetRest: 480.7, tabBarInset: 83, margins: { top: 12, bottom: 12, side: 32 }, containerHeight: 874, minBand: 120 });
    expect(tight).toStrictEqual({ top: 134, bottom: 492.7, left: 32, right: 32 });
    const low = visibleMapPadding({ controlsBottom: 122, sheetRest: 262.2, tabBarInset: 83, margins: { top: 48, bottom: 24, side: 32 }, containerHeight: 874, minBand: 120 });
    expect(low).toStrictEqual({ top: 170, bottom: 286.2, left: 32, right: 32 });
  });
  it('clears the top controls above, the resting sheet below, and keeps the frame margin on every side', () => {
    // Act
    const padding = visibleMapPadding({ controlsBottom: 160, sheetRest: 560, tabBarInset: 83, margins: ALL_32, ...TALL });

    // Assert
    expect(padding).toStrictEqual({ top: 192, bottom: 592, left: 32, right: 32 });
  });

  it('clears the tab bar below when the sheet rests under it, as a sheet that covers the whole map does', () => {
    // Act & Assert
    expect(visibleMapPadding({ controlsBottom: 160, sheetRest: 0, tabBarInset: 83, margins: ALL_32, ...TALL }).bottom).toBe(115);
    expect(visibleMapPadding({ controlsBottom: 0, sheetRest: 0, tabBarInset: 0, margins: ALL_32, ...TALL })).toStrictEqual({
      top: 32,
      bottom: 32,
      left: 32,
      right: 32,
    });
  });

  it('keeps the sheet while the band it leaves is at least the floor', () => {
    // Arrange: 132 above, 432 below, and exactly 120 between.
    const input = { controlsBottom: 100, sheetRest: 400, tabBarInset: 83, margins: ALL_32, minBand: 120 };

    // Act & Assert
    expect(visibleMapPadding({ ...input, containerHeight: 684 }).bottom).toBe(432);
  });

  it('drops the sheet and pads by the tab bar alone when the band would be under the floor, so the camera centres in the map the sheet would reveal', () => {
    // Arrange: one point short of the floor, a 70% line sheet on an iPhone 17 Pro, and a panel root under the chip row.
    const input = { controlsBottom: 100, sheetRest: 400, tabBarInset: 83, margins: ALL_32, minBand: 120 };

    // Act & Assert
    expect(visibleMapPadding({ ...input, containerHeight: 683 }).bottom).toBe(115);
    expect(
      visibleMapPadding({ controlsBottom: 161, sheetRest: 612, tabBarInset: 83, margins: ALL_32, containerHeight: 874, minBand: 120 }),
    ).toStrictEqual({ top: 193, bottom: 115, left: 32, right: 32 });
    expect(
      visibleMapPadding({ controlsBottom: 161, sheetRest: 713, tabBarInset: 83, margins: ALL_32, containerHeight: 874, minBand: 120 }).bottom,
    ).toBe(115);
  });
});

describe('the line sheet at its opening height against the visible-band floor', () => {
  const route = (windowHeight: number, controlsBottom: number) =>
    visibleMapPadding({
      controlsBottom,
      sheetRest: (windowHeight * MID_PERCENT) / 100,
      tabBarInset: 83,
      margins: { top: 32, bottom: 32, side: 32 },
      containerHeight: windowHeight,
      minBand: MIN_VISIBLE_BAND,
    });

  it('keeps the sheet in the padding on an iPhone 17 Pro, with a band of about 168 pt', () => {
    // Arrange: an 874 pt window, the controls' bottom near 161.
    // Act
    const padding = route(874, 161);

    // Assert
    expect(874 - padding.top - padding.bottom).toBeGreaterThanOrEqual(MIN_VISIBLE_BAND);
    expect(padding.bottom).toBeCloseTo(0.55 * 874 + 32, 5);
  });

  it('drops the sheet on a 667 pt iPhone, where the band is about 114 pt, just under the floor', () => {
    // Arrange: a 667 pt window, a 20 pt top inset puts the controls' bottom near 122.
    // Act
    const padding = route(667, 122);

    // Assert
    expect(padding.bottom).toBe(83 + 32);
  });
});

describe('the Naver zoom scale at the campuses’ latitude', () => {
  it('is one level deeper than Web Mercator with 256 pt tiles: zoom 14 is 3.79 m per point, measured on the simulator', () => {
    expect(metresPerPointAt(14)).toBeCloseTo(3.79, 2);
    expect(metresPerPointAt(13)).toBeCloseTo(2 * metresPerPointAt(14), 6);
  });

  it('gives the zoom at which a span fills a band, the tighter axis deciding', () => {
    // 종로02’s path, 2131 m north to south and 690 m east to west, in the 55% band of an iPhone 17 Pro with 12 pt margins.
    expect(zoomToFit({ northSouth: 2131, eastWest: 690 }, { width: 338, height: 247 })).toBeCloseTo(12.81, 2);
    // A square box in a wide band is width-limited only when the width is the tighter side.
    expect(zoomToFit({ northSouth: 100, eastWest: 100 }, { width: 50, height: 500 })).toBeCloseTo(zoomToFit({ northSouth: 100, eastWest: 100 }, { width: 50, height: 50 }), 6);
  });
});

describe('sdkMapPadding: the band handed to the SDK with the logo pulled into the top-left corner', () => {
  // The band a 55% line sheet leaves under the task field on an iPhone 17 Pro.
  const BAND = { top: 134, bottom: 492.7, left: 32, right: 32 };
  const centreOf = (p: { top: number; bottom: number; left: number; right: number }, size: { width: number; height: number }) => ({
    x: (p.left + size.width - p.right) / 2,
    y: (p.top + size.height - p.bottom) / 2,
  });

  it('drops the side padding and lifts the top to where the logo should sit, under the controls', () => {
    // Act
    const padding = sdkMapPadding(BAND, { logoTop: 60 });

    // Assert
    expect(padding.left).toBe(0);
    expect(padding.right).toBe(0);
    expect(padding.top).toBe(60);
  });

  it('keeps the centre of the band, so a move, a follow and a settle read the same point as before', () => {
    // Arrange
    const size = { width: 402, height: 874 };

    // Act
    const padding = sdkMapPadding(BAND, { logoTop: 60 });

    // Assert
    expect(centreOf(padding, size)).toStrictEqual(centreOf(BAND, size));
  });

  it('lifts the top only as far as the bottom can give, so the centre never moves and no side goes negative', () => {
    // Arrange: a sheet that covers the whole map leaves the tab bar and its margin, 115, below a 160 top.
    const band = { top: 192, bottom: 115, left: 32, right: 32 };

    // Act
    const padding = sdkMapPadding(band, { logoTop: 10 });

    // Assert
    expect(padding).toStrictEqual({ top: 77, bottom: 0, left: 0, right: 0 });
  });

  it('never pushes the top down, and reads a corner above the map as its edge', () => {
    // Act & Assert
    expect(sdkMapPadding(BAND, { logoTop: 200 }).top).toBe(134);
    const aboveTheMap = sdkMapPadding(BAND, { logoTop: -62 });
    expect(aboveTheMap.top).toBe(0);
    expect(aboveTheMap.bottom).toBeCloseTo(358.7, 9);
  });
});

describe('logoMarginOf: the NAVER logo hangs under the controls without a padding too', () => {
  it('hangs the logo where a padded map hangs it, the padding top plus the SDK’s floored margin', () => {
    // Arrange: a band with room to lift the top all the way to the logo.
    const padded = sdkMapPadding({ top: 134, bottom: 492.7, left: 32, right: 32 }, { logoTop: 60 });

    // Act
    const margin = logoMarginOf(undefined, { logoTop: 60 });

    // Assert
    expect(margin?.top).toBe(padded.top + NAVER_LOGO_MARGIN);
  });

  it('leaves the margin to the padding where there is one, which already places the logo', () => {
    // Act & Assert
    expect(logoMarginOf({ top: 60, bottom: 400, left: 0, right: 0 }, { logoTop: 60 })).toBeUndefined();
  });

  it('reads a corner above the map as its edge', () => {
    // Act & Assert
    expect(logoMarginOf(undefined, { logoTop: -20 })?.top).toBe(NAVER_LOGO_MARGIN);
  });
});

describe('boundsForPadding: a frame fitted into the SDK padding lands where it landed in the band', () => {
  const BAND = { top: 134, bottom: 492.7, left: 32, right: 32 };
  const SIZE = { width: 402, height: 874 };
  // 종로07, roughly: about 1.3 km north to south and 0.9 km east to west.
  const ROUTE = { sw: { lat: 37.578, lng: 126.994 }, ne: { lat: 37.590, lng: 127.004 } };
  const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const contentOf = (p: typeof BAND) => ({ width: SIZE.width - p.left - p.right, height: SIZE.height - p.top - p.bottom });
  /** What fit-bounds picks, per axis, in log2 units: the content's points over the frame's projected span. */
  const fitZoomOf = (b: typeof ROUTE, content: { width: number; height: number }) => ({
    x: Math.log2(content.width / (b.ne.lng - b.sw.lng)),
    y: Math.log2(content.height / (mercatorY(b.ne.lat) - mercatorY(b.sw.lat))),
  });

  it('fits at the zoom the band gave, on each axis', () => {
    // Arrange
    const padding = sdkMapPadding(BAND, { logoTop: 60 });

    // Act
    const bounds = boundsForPadding(ROUTE, { band: BAND, padding, size: SIZE });

    // Assert
    const before = fitZoomOf(ROUTE, contentOf(BAND));
    const after = fitZoomOf(bounds, contentOf(padding));
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('keeps the frame’s centre, so the route sits where the band centred it', () => {
    // Arrange
    const padding = sdkMapPadding(BAND, { logoTop: 60 });

    // Act
    const bounds = boundsForPadding(ROUTE, { band: BAND, padding, size: SIZE });

    // Assert
    expect((bounds.sw.lng + bounds.ne.lng) / 2).toBeCloseTo((ROUTE.sw.lng + ROUTE.ne.lng) / 2, 12);
    expect((mercatorY(bounds.sw.lat) + mercatorY(bounds.ne.lat)) / 2).toBeCloseTo(
      (mercatorY(ROUTE.sw.lat) + mercatorY(ROUTE.ne.lat)) / 2,
      12,
    );
  });

  it('returns the frame unchanged where the padding is the band', () => {
    // Act & Assert
    expect(boundsForPadding(ROUTE, { band: BAND, padding: BAND, size: SIZE })).toStrictEqual(ROUTE);
  });
});
