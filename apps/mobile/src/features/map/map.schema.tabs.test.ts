/**
 * `tabs` and `opensIn` on `/map/config` (ADR 0022 d1, the server contract of
 * 2026-10-23): which tab's default lens draws a layer, which tab's chip row
 * shows a chip, and which tab a chip runs in.
 *
 * Absent is the meaningful default and is kept absent, so a server predating
 * the fields parses to exactly what it did before them. A tab id this build
 * does not know is dropped from a list; a chip that runs only in such a tab is
 * dropped whole, since it would run in the wrong one.
 */

import { describe, it, expect } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import { mapConfigSchema } from './map-config.schema';

const parseConfig = (data: unknown) => parseOrThrow(mapConfigSchema, data, 'map.config');

const layer = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  label: 'L',
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/x',
  ...over,
});

const chip = (over: Record<string, unknown> = {}) => ({
  id: 'building_map',
  label: '건물지도',
  icon: null,
  action: { kind: 'link', actionType: 'route', actionValue: '/building-map' },
  ...over,
});

const parseLayer = (over: Record<string, unknown>) => parseConfig({ layers: [layer(over)] }).layers[0];
const parseChips = (over: Record<string, unknown>) => parseConfig({ chips: [chip(over)] }).chips;

describe('layer tabs', () => {
  it('keeps an absent list absent, so the layer reads as a map-tab layer', () => {
    expect(parseLayer({})).not.toHaveProperty('tabs');
  });

  it('reads both tabs', () => {
    expect(parseLayer({ tabs: ['map', 'transit'] })?.tabs).toEqual(['map', 'transit']);
    expect(parseLayer({ tabs: ['transit'] })?.tabs).toEqual(['transit']);
  });

  it('drops a tab id this build does not know and keeps the rest', () => {
    expect(parseLayer({ tabs: ['transit', 'bike', 3] })?.tabs).toEqual(['transit']);
  });

  it('keeps an explicit empty list, which no tab draws by default', () => {
    expect(parseLayer({ tabs: [] })?.tabs).toEqual([]);
  });

  it('reads a list that is not a list as absent', () => {
    expect(parseLayer({ tabs: 'transit' })).not.toHaveProperty('tabs');
    expect(parseLayer({ tabs: null })).not.toHaveProperty('tabs');
  });
});

describe('chip tabs and opensIn', () => {
  it('keeps both absent on a chip that names neither', () => {
    const [out] = parseChips({});
    expect(out).not.toHaveProperty('tabs');
    expect(out).not.toHaveProperty('opensIn');
  });

  it('reads tabs, dropping an unknown id', () => {
    expect(parseChips({ tabs: ['map', 'transit', 'bike'] })[0]?.tabs).toEqual(['map', 'transit']);
  });

  it('reads opensIn', () => {
    expect(parseChips({ opensIn: 'transit' })[0]?.opensIn).toBe('transit');
    expect(parseChips({ opensIn: null })[0]).not.toHaveProperty('opensIn');
  });

  it('drops a chip that runs in a tab this build does not have', () => {
    expect(parseChips({ opensIn: 'bike' })).toEqual([]);
    expect(parseChips({ opensIn: 3 })).toEqual([]);
  });
});

describe('the layers chip action (ADR 0022 d1)', () => {
  const CAMERA = { lat: 37.5876, lng: 126.9935, zoom: 16, tilt: 0, bearing: 0, durationMs: 400 };
  const layersAction = (over: Record<string, unknown> = {}) => ({
    action: { kind: 'layers', layerIds: ['hssc_route', 'jongro02_route'], camera: null, ...over },
  });

  it('reads the layers it turns on, and a null camera as no move', () => {
    // Act
    const [out] = parseChips(layersAction());

    // Assert
    expect(out?.action).toEqual({ kind: 'layers', layerIds: ['hssc_route', 'jongro02_route'], camera: null });
  });

  it('reads a camera to move to', () => {
    // Act
    const [out] = parseChips(layersAction({ camera: CAMERA }));

    // Assert
    expect(out?.action).toEqual({ kind: 'layers', layerIds: ['hssc_route', 'jongro02_route'], camera: CAMERA });
  });

  it('drops a chip whose layer list is not a list, or whose camera names no position', () => {
    // Act
    const dropped = [
      parseChips(layersAction({ layerIds: 'hssc_route' })),
      parseChips(layersAction({ camera: { zoom: 16 } })),
    ];

    // Assert
    expect(dropped).toEqual([[], []]);
  });

  it('keeps the string ids of a list and leaves the rest out', () => {
    // Act
    const [out] = parseChips(layersAction({ layerIds: ['hssc_route', 3, '', null] }));

    // Assert
    expect(out?.action).toMatchObject({ layerIds: ['hssc_route'] });
  });
});
