/**
 * The floors a route's frame meets, and the levers that keep them true
 * (ADR 0022 d3, the 2026-10-24 framing decision), all read off the detent
 * size table (`coveredHeightAt`): the map's zoom floor must admit the zoom
 * every live line needs in the band of each fitting level on the phones we
 * ship to, the served route layers must still draw there, the band must
 * stay above `MIN_VISIBLE_BAND`, the stops must draw as the owner chose at
 * each level, and the label room above a line must hold a direction label.
 * A margin, a level's height or a chrome height that breaks one fails here
 * rather than on a device.
 */

import { describe, expect, it, vi } from 'vitest';
import configLive from './__fixtures__/map-config-tabs-live.json';
import configServer from './__fixtures__/server-map-config.transit-tabs-ko.json';
import bboxes from './__fixtures__/route-bboxes.json';
import { visibleMapPadding, zoomToFit } from './camera-move.rules';
import { MAP_TOOLBAR_HEIGHT } from './map-layout.constants';
import { LABEL_BOX } from './components/canvas/marker.constants';
import { directionLabelAnchor, stopMarkerShapeAt } from './components/canvas/task-marker.rules';
import type { MapDetent } from './sheet-detents.constants';
import { contentBottomOf, coveredHeightAt, toMapSheetStops, type DetentMeasure } from './sheet-detents.rules';
import { MAP_SHEET_PROFILES } from './sheet-stack.constants';
import { STOP_PIN_MIN_ZOOM, MAP_FRAME_MARGIN, MIN_CAMERA_ZOOM, MIN_VISIBLE_BAND } from './camera.constants';
import { controlsBottomOf } from './map-layout.rules';

// `map-layout.constants` reads SDS's control sizes, and SDS loads
// Reanimated, which Node cannot run. The values are SDS's own.
vi.mock('@skkuverse/sds', () => ({ GLASS_BUTTON_GROUP_SIZE: 44, GLASS_CHIP_HEIGHT: 39 }));

/** `SheetHandle`'s height (SDS `SHEET_HANDLE_HEIGHT`). */
const HANDLE = 22;

/** Metres per degree of latitude, and of longitude at the box's latitude. */
const M_PER_DEG_LAT = 111320;
function spanOf(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
  const lat = ((box.minLat + box.maxLat) / 2) * (Math.PI / 180);
  return {
    northSouth: (box.maxLat - box.minLat) * M_PER_DEG_LAT,
    eastWest: (box.maxLng - box.minLng) * M_PER_DEG_LAT * Math.cos(lat),
  };
}

interface Phone {
  name: string;
  width: number;
  height: number;
  topInset: number;
  /** The tab bar's overlap of the host's bottom. ASSUMED for the SE, landscape and the iPad: no measurement of them is recorded. */
  overlap: number;
}

/** The phones the fit has to work on: the largest and the smallest current window, upright. */
const PHONES: readonly Phone[] = [
  { name: 'iPhone 17 Pro', width: 402, height: 874, topInset: 62, overlap: 83 },
  { name: 'iPhone SE 3', width: 375, height: 667, topInset: 20, overlap: 49 },
];

/** Windows the map tab also reaches (`orientation: "default"`, `supportsTablet`), where levels may squeeze. */
const OTHER_WINDOWS: readonly Phone[] = [
  { name: 'iPhone 17 Pro landscape', width: 874, height: 402, topInset: 0, overlap: 49 },
  { name: 'iPad Air 11', width: 820, height: 1180, topInset: 24, overlap: 65 },
];

/** The size table's inputs on a phone under the shared map's glass toolbar, with the chips on. */
function measureOf(phone: Phone): DetentMeasure {
  const metrics = { topInset: phone.topInset, toolbarHeight: MAP_TOOLBAR_HEIGHT, chipRow: true };
  return {
    containerHeight: phone.height,
    controlsBottom: { world: controlsBottomOf('world', metrics), taskField: controlsBottomOf('taskField', metrics) },
    minFrame: HANDLE + contentBottomOf(phone.overlap),
  };
}

const ROUTE = MAP_SHEET_PROFILES.route;
const FITTING = (['min', 'mid'] as const).filter((level) => ROUTE.at[level].framing.kind === 'fit');

/** The map band a line's frame fits into at a level: under the task field, over the sheet, inside the level's margins. */
function bandOf(phone: Phone, level: 'min' | 'mid') {
  const m = measureOf(phone);
  const framing = ROUTE.at[level].framing;
  if (framing.kind !== 'fit') throw new Error(`${level} keeps the camera`);
  const covered = coveredHeightAt(level, ROUTE.chrome, m) as number;
  return {
    width: phone.width - 2 * MAP_FRAME_MARGIN,
    height: phone.height - covered - m.controlsBottom.taskField - framing.margin.top - framing.margin.bottom,
  };
}

describe('the arithmetic top controls match what the host measured (iPhone 17 Pro, 2026-10-24)', () => {
  it("ends the world's two rows at 171 and the task field at 122", () => {
    const m = measureOf(PHONES[0]!);
    expect(m.controlsBottom).toEqual({ world: 171, taskField: 122 });
  });

  it('drops the chip row from a tab that has no chips', () => {
    expect(controlsBottomOf('world', { topInset: 62, toolbarHeight: MAP_TOOLBAR_HEIGHT, chipRow: false })).toBe(122);
  });
});

describe('the zoom floor admits every live line at every fitting level of the route profile', () => {
  for (const phone of PHONES) {
    for (const level of FITTING) {
      for (const route of bboxes.routes) {
        it(`${route.id} fits the ${level} band on an ${phone.name} at or above the floor`, () => {
          expect(zoomToFit(spanOf(route), bandOf(phone, level))).toBeGreaterThanOrEqual(MIN_CAMERA_ZOOM);
        });
      }
    }
  }
});

describe('the served route layers still draw at the floor', () => {
  for (const [name, config] of [
    ['map-config-tabs-live', configLive],
    ['server-map-config.transit-tabs-ko', configServer],
  ] as const) {
    it(`${name}: every *_route layer's style.minZoom is at most MIN_CAMERA_ZOOM`, () => {
      const routes = config.data.layers.filter((layer) => layer.id.endsWith('_route'));
      expect(routes.length).toBeGreaterThan(0);
      for (const layer of routes) {
        expect((layer as { style?: { minZoom?: number } }).style?.minZoom ?? 0).toBeLessThanOrEqual(MIN_CAMERA_ZOOM);
      }
    });
  }
});

describe('a line draws its stops as the owner chose at each level (STOP_PIN_MIN_ZOOM)', () => {
  /**
   * The intent, per phone: at `mid` the long lines are dots and HSSC, eleven
   * stops, keeps its pins; at `min` the 17 Pro shows every line's pins. On
   * an SE, 종로02 and 종로08 stay dots at `min` as they were at the old 30%
   * (13.16 and 13.06); its 49 pt overlap is assumed.
   */
  const INTENT: Record<string, Record<'min' | 'mid', Record<string, 'dot' | 'pin'>>> = {
    'iPhone 17 Pro': {
      min: { jongro02: 'pin', jongro07: 'pin', jongro08: 'pin', hssc: 'pin' },
      mid: { jongro02: 'dot', jongro07: 'dot', jongro08: 'dot', hssc: 'pin' },
    },
    'iPhone SE 3': {
      min: { jongro02: 'dot', jongro07: 'pin', jongro08: 'dot', hssc: 'pin' },
      mid: { jongro02: 'dot', jongro07: 'dot', jongro08: 'dot', hssc: 'pin' },
    },
  };

  for (const phone of PHONES) {
    for (const level of FITTING) {
      it(`${phone.name} at ${level}`, () => {
        const shapes = Object.fromEntries(
          bboxes.routes.map((route) => [route.id, stopMarkerShapeAt(zoomToFit(spanOf(route), bandOf(phone, level)))]),
        );
        expect(shapes).toEqual(INTENT[phone.name]![level]);
      });
    }
  }

  it('reads its threshold where the evidence put it', () => {
    expect(STOP_PIN_MIN_ZOOM).toBe(13.4);
  });
});

describe('a fitting level leaves the visible band the padding needs (MIN_VISIBLE_BAND)', () => {
  for (const phone of PHONES) {
    for (const level of FITTING) {
      it(`${phone.name} at ${level}`, () => {
        const framing = ROUTE.at[level].framing;
        if (framing.kind !== 'fit') return;
        const band = bandOf(phone, level).height + framing.margin.top + framing.margin.bottom;
        expect(band).toBeGreaterThanOrEqual(MIN_VISIBLE_BAND);
      });
    }
  }
});

describe('a squeezed window keeps its levels in order and never pads past the map', () => {
  const profiles = Object.entries(MAP_SHEET_PROFILES);
  for (const phone of [...PHONES, ...OTHER_WINDOWS]) {
    it(`${phone.name}: every profile's stops rise, and the padding at each leaves a band or falls back to the tab bar`, () => {
      const m = measureOf(phone);
      const labels: Record<MapDetent, string> = { min: '', mid: '', max: '', page: '' };
      for (const [, profile] of profiles) {
        const stops = toMapSheetStops(profile, MAP_SHEET_PROFILES.campusRoot, m, labels);
        if (stops.position.kind !== 'stops') throw new Error('expected stops');
        const heights = stops.position.stops.map((stop) => (stop.kind === 'page' ? phone.height : (stop.height as number)));
        expect(heights).toEqual([...heights].sort((a, b) => a - b));
        expect(new Set(heights).size).toBe(heights.length);
        for (const height of heights) {
          const padding = visibleMapPadding({
            controlsBottom: m.controlsBottom[profile.chrome],
            sheetRest: height >= phone.height ? 0 : height,
            tabBarInset: phone.overlap,
            margins: { top: MAP_FRAME_MARGIN, bottom: MAP_FRAME_MARGIN, side: MAP_FRAME_MARGIN },
            containerHeight: phone.height,
            minBand: MIN_VISIBLE_BAND,
          });
          expect(padding.top + padding.bottom).toBeLessThan(phone.height);
        }
      }
    });
  }
});

describe("a line's room above at min holds a direction label over its northernmost stop", () => {
  it('is at least the label box hung over a stop pin', () => {
    const framing = ROUTE.at.min.framing;
    if (framing.kind !== 'fit') throw new Error('min fits');
    expect(framing.margin.top).toBeGreaterThanOrEqual(LABEL_BOX.height * directionLabelAnchor('pin').y);
  });
});
