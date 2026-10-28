/**
 * The server's published map fixtures read cleanly: each parses, keeps every
 * item it serves, and reports no drop. A drop here means the app and the
 * server disagree about the contract.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { chipsFor, toChipLayers } from './chips.rules';
import { mapConfigSchema } from './map-config.schema';
import { mapOverlaysSchema } from './overlay.schema';
import type { MapConfig } from './map-config.types';
import configBaseChips from './__fixtures__/server-map-config.base-chips-ko.json';
import configFestival from './__fixtures__/server-map-config.festival-synthetic.json';
import configProduction from './__fixtures__/server-map-config.production-ko.json';
import configTransitTabs from './__fixtures__/server-map-config.transit-tabs-ko.json';
import overlaysCampus from './__fixtures__/server-map-overlays.campus-production-ko.json';
import overlaysEvent from './__fixtures__/server-map-overlays.event-production-ko.json';
import overlaysEventSynthetic from './__fixtures__/server-map-overlays.event-synthetic.json';
import { tabDefaultFor } from './layers.rules';

const reports: [string, number][] = [];
setDropReporter((where, index) => reports.push([where, index]));
afterEach(() => {
  reports.length = 0;
});

const CONFIGS = { configBaseChips, configFestival, configProduction, configTransitTabs };
const OVERLAYS = { overlaysCampus, overlaysEvent, overlaysEventSynthetic };

describe('the server map fixtures', () => {
  it.each(Object.entries(CONFIGS))('%s reads every layer, campus and chip', (_name, fixture) => {
    // Act
    const config = parseOrThrow(mapConfigSchema, fixture.data, 'map.config');

    // Assert
    expect(config.layers).toHaveLength((fixture.data as { layers: unknown[] }).layers.length);
    expect(reports).toStrictEqual([]);
  });

  it.each(Object.entries(OVERLAYS))('%s reads every overlay', (_name, fixture) => {
    // Act
    const overlays = parseOrThrow(mapOverlaysSchema, fixture.data, 'map.overlays');

    // Assert
    expect(overlays).toHaveLength((fixture.data as { overlays: unknown[] }).overlays.length);
    expect(reports).toStrictEqual([]);
  });
});

describe('the transit tabs fixture (ADR 0022 d1)', () => {
  // WHY: parsed inside each test, so a drop it reports lands in that test and not in the suite above.
  let config: MapConfig;
  beforeEach(() => {
    config = parseOrThrow(mapConfigSchema, configTransitTabs.data, 'map.config');
  });
  const ROUTES = ['jongro02_route', 'jongro08_route', 'jongro07_route', 'hssc_route'];
  /**
   * Synthetic: a `layers` chip in the wire shape the server served for its
   * shuttle routes chip until 2026-10-24. No base chip is one now, but the
   * wire still allows it, so it rides beside the served chips.
   */
  const ROUTE_LINES = {
    id: 'route_lines',
    label: '노선',
    icon: null,
    action: { kind: 'layers', layerIds: ROUTES, camera: null },
    isReset: false,
    list: null,
    tabs: ['map', 'transit'],
    opensIn: 'map',
  };
  const parseWithRouteLines = () =>
    parseOrThrow(mapConfigSchema, { ...configTransitTabs.data, chips: [...configTransitTabs.data.chips, ROUTE_LINES] }, 'map.config');

  it('reads every chip the server serves', () => {
    expect(config.chips.map((c) => c.id)).toEqual(configTransitTabs.data.chips.map((c) => c.id));
  });

  it('reads a layers chip beside them as the four route layers, no camera, in both tabs, run in the map tab', () => {
    // Act
    const routeLines = parseWithRouteLines().chips.find((c) => c.id === 'route_lines');

    // Assert
    expect(reports).toStrictEqual([]);
    expect(routeLines).toMatchObject({
      action: { kind: 'layers', layerIds: ROUTES, camera: null },
      tabs: ['map', 'transit'],
      opensIn: 'map',
    });
  });

  it('shows the link chips in both tabs and the building code chip in neither on the shared map', () => {
    // Act
    const rows = { map: chipsFor('byTab', 'map', config.chips), transit: chipsFor('byTab', 'transit', config.chips) };

    // Assert
    expect(rows.transit.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry']);
    expect(rows.map.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry']);
  });

  it('shows a layers chip over the served route layers in both tabs', () => {
    // Arrange
    const { chips } = parseWithRouteLines();

    // Act
    const rows = { map: chipsFor('byTab', 'map', chips), transit: chipsFor('byTab', 'transit', chips) };

    // Assert
    expect(rows.transit.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry', 'route_lines']);
    expect(rows.map.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry', 'route_lines']);
  });

  it('turns exactly the four served route layers on for a layers chip naming them', () => {
    // Arrange
    const routeLines = parseWithRouteLines().chips.find((c) => c.id === 'route_lines')!;

    // Act
    const layers = toChipLayers(routeLines, config.layers);

    // Assert
    expect(layers).toEqual(Object.fromEntries(ROUTES.map((id) => [id, true])));
  });

  it('leaves the native-tab campus tab as installed builds see it: every link chip, and no tab default', () => {
    // Act
    const row = chipsFor('all', 'map', config.chips);
    const tabDefault = tabDefaultFor('all', 'map', config.layers);

    // Assert
    expect(row.map((c) => c.id)).toEqual(['building_map', 'building_code', 'lost_found', 'inquiry']);
    expect(tabDefault).toEqual({});
  });
});
