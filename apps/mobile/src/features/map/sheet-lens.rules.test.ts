/**
 * What the map draws for a tab's open sheets (ADR 0022 rule 1): every lens on
 * the focused tab's stack, merged, with one pin per place.
 */

import { describe, it, expect } from 'vitest';
import {
  applyMapLens,
  drawsWhenDimmed,
  overlayLensOf,
  type PublishedLens,
  type ResolvedOverlayLens,
} from './sheet-lens.rules';
import type { MapLayerDef } from './map-config.types';
import type { TaskOverlay } from './sheet-stack.types';
import { MAP_LENS_ROLES, type MapLensName, type TaskOverlayRole } from './sheet-stack.constants';

const marker = (id: string, layerId: string, subtitle: string | null = null, role: TaskOverlayRole = 'stop'): TaskOverlay => ({
  kind: 'marker',
  role,
  id,
  layerId,
  campus: 'hssc',
  text: { ko: id, en: id },
  subtitle: subtitle === null ? null : { ko: subtitle, en: subtitle },
  hours: [],
  fields: [],
  actions: [],
  order: 0,
  facets: {},
  orderByOption: {},
  tap: null,
  lat: 37.58,
  lng: 127.0,
  pinPriority: 0,
  locationAccuracy: 'exact',
});

const published = (tab: 'map' | 'transit', entryId: number, lens: PublishedLens['lens']): PublishedLens => ({
  tab,
  entryId,
  lens,
});

describe('overlayLensOf', () => {
  it('draws nothing and dims nothing with no lens open', () => {
    // Act
    const lens = overlayLensOf([], 'transit', [1, 2]);

    // Assert
    expect(lens.overlays).toStrictEqual([]);
    expect(lens.dimOthers).toBe(false);
    expect(lens.hiddenIds.size).toBe(0);
  });

  it('reads only the focused tab, and only entries still on its stack', () => {
    // Arrange
    const lenses = [
      published('map', 1, { overlays: [marker('a', 'x')], dimOthers: true }),
      published('transit', 2, { overlays: [marker('b', 'x')] }),
      published('transit', 9, { overlays: [marker('gone', 'x')], dimOthers: true }),
    ];

    // Act
    const lens = overlayLensOf(lenses, 'transit', [2]);

    // Assert
    expect(lens.overlays.map((o) => o.id)).toStrictEqual(['b']);
    expect(lens.dimOthers).toBe(false);
  });

  it('keeps a lower sheet’s pins under the sheet above it, and dims while any of them asks', () => {
    // Arrange: a line's stop pins, then a stop pushed over it.
    const lenses = [
      published('transit', 2, { overlays: [marker('focus', 'transit_focus')] }),
      published('transit', 1, { overlays: [marker('s1', 'jongro07_stops'), marker('s2', 'jongro07_stops')], dimOthers: true }),
    ];

    // Act
    const lens = overlayLensOf(lenses, 'transit', [1, 2]);

    // Assert
    expect(lens.overlays.map((o) => o.id).sort()).toStrictEqual(['focus', 's1', 's2']);
    expect(lens.dimOthers).toBe(true);
  });

  it('draws one pin per place: the higher sheet’s, keeping the lower one’s subtitle when it has none', () => {
    // Arrange
    const lenses = [
      published('transit', 1, { overlays: [marker('seoul-01592', 'jongro07_stops', '혜화동로터리 방면')] }),
      published('transit', 2, { overlays: [marker('seoul-01592', 'transit_focus')] }),
    ];

    // Act
    const lens = overlayLensOf(lenses, 'transit', [1, 2]);

    // Assert
    expect(lens.overlays).toHaveLength(1);
    expect(lens.overlays[0]).toMatchObject({
      layerId: 'transit_focus',
      subtitle: { ko: '혜화동로터리 방면', en: '혜화동로터리 방면' },
    });
  });

  it('draws a place a line lists twice once (a loop’s terminal is its first and last station)', () => {
    // Arrange
    const lenses = [
      published('transit', 1, { overlays: [marker('seoul-01881', 'jongro02_stops'), marker('seoul-01881', 'jongro02_stops')] }),
    ];

    // Act
    const lens = overlayLensOf(lenses, 'transit', [1]);

    // Assert
    expect(lens.overlays).toHaveLength(1);
  });

  it('hides every place any open sheet hides', () => {
    // Arrange
    const lenses = [
      published('map', 1, { hiddenIds: new Set(['p1']) }),
      published('map', 2, { hiddenIds: new Set(['p2']) }),
    ];

    // Act
    const lens = overlayLensOf(lenses, 'map', [1, 2]);

    // Assert
    expect([...lens.hiddenIds].sort()).toStrictEqual(['p1', 'p2']);
  });

  describe('the task header: the lowest publisher names the task', () => {
    const noop = () => {};
    const LINE = { title: '종로07', onClose: noop };
    const STOP = { title: '성균관대정문', onClose: noop };

    it('is the line’s under a stop pushed over it, so ✕ on the chrome closes the line and the stop with it', () => {
      // Arrange
      const lenses = [
        published('transit', 2, { header: STOP }),
        published('transit', 1, { header: LINE }),
      ];

      // Act
      const lens = overlayLensOf(lenses, 'transit', [1, 2]);

      // Assert
      expect(lens.header).toBe(LINE);
    });

    it('falls to the only publisher: a stop opened from search names itself, over a lower sheet with no header', () => {
      // Arrange
      const lenses = [
        published('transit', 1, { overlays: [marker('a', 'x')] }),
        published('transit', 2, { header: STOP }),
      ];

      // Act & Assert
      expect(overlayLensOf(lenses, 'transit', [1, 2]).header).toBe(STOP);
    });

    it('is gone with the entry that published it, and null with no header open', () => {
      // Arrange
      const lenses = [published('transit', 1, { header: LINE }), published('transit', 2, { header: STOP })];

      // Act & Assert: the line popped, the stop alone on the stack.
      expect(overlayLensOf(lenses, 'transit', [2]).header).toBe(STOP);
      expect(overlayLensOf(lenses, 'transit', []).header).toBeNull();
      expect(overlayLensOf([], 'transit', [1]).header).toBeNull();
    });
  });
});

describe('applyMapLens: what a detent shows of the task’s overlays', () => {
  const resolved = (): ResolvedOverlayLens => ({
    overlays: [
      marker('s1', 'jongro07_stops', null, 'stop'),
      marker('d1', 'jongro07_labels', null, 'directionLabel'),
      marker('f1', 'transit_focus', null, 'focusedPlace'),
    ],
    dimOthers: true,
    hiddenIds: new Set(['p1']),
    header: null,
  });
  const idsUnder = (lens: MapLensName) => applyMapLens(resolved(), lens).overlays.map((o) => o.id);

  it('keeps every role for everything and the focused stop, the stops and labels for a route with stops and labels, the stops alone for a route with stops, and nothing for the route alone', () => {
    expect(idsUnder('everything')).toStrictEqual(['s1', 'd1', 'f1']);
    expect(idsUnder('focusedStop')).toStrictEqual(['s1', 'd1', 'f1']);
    expect(idsUnder('routeWithStopsAndLabels')).toStrictEqual(['s1', 'd1']);
    expect(idsUnder('routeWithStops')).toStrictEqual(['s1']);
    expect(idsUnder('routeOnly')).toStrictEqual([]);
  });

  it('is the table, so a lens shows exactly the roles MAP_LENS_ROLES names for it', () => {
    for (const lens of Object.keys(MAP_LENS_ROLES) as MapLensName[]) {
      const roles = applyMapLens(resolved(), lens).overlays.map((o) => o.role);
      expect(new Set(roles)).toStrictEqual(new Set(MAP_LENS_ROLES[lens]));
    }
  });

  it('keeps the dimming, the hidden places and the header whatever it drops', () => {
    const lens = applyMapLens(resolved(), 'routeOnly');
    expect(lens.dimOthers).toBe(true);
    expect([...lens.hiddenIds]).toStrictEqual(['p1']);
    expect(lens.header).toBeNull();
  });

  it('returns the same object when nothing is dropped, so the map does not re-render for it', () => {
    const before = resolved();
    expect(applyMapLens(before, 'everything')).toBe(before);
    const empty = overlayLensOf([], 'transit', []);
    expect(applyMapLens(empty, 'routeOnly')).toBe(empty);
  });
});

describe('drawsWhenDimmed', () => {
  const layer = (markerStyle: MapLayerDef['markerStyle']): MapLayerDef => ({
    id: 'l',
    label: 'l',
    defaultVisibleWhen: { kind: 'always' },
    endpoint: '/map/overlays/campus',
    chipGroupId: null,
    userConfigurable: true,
    markerStyle,
  });

  it('keeps a dimmed layer’s text labels and leaves out its icons, zones and lines', () => {
    // Arrange
    const label = marker('1', 'building_labels');
    const zone: TaskOverlay = { ...label, kind: 'polygon', rings: [] } as TaskOverlay;

    // Act / Assert
    expect(drawsWhenDimmed(label, layer('textLabel'))).toBe(true);
    expect(drawsWhenDimmed(label, layer('numberCircle'))).toBe(false);
    expect(drawsWhenDimmed(label, layer('placeDot'))).toBe(false);
    expect(drawsWhenDimmed(zone, layer('textLabel'))).toBe(false);
  });
});
