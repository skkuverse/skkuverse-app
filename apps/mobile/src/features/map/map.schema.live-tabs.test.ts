/**
 * The chip rows production serves (ADR 0022 d1), read through the real
 * parser and row selection. `map-config-tabs-live.json` is
 * `GET https://api.skkuverse.com/map/config`, Accept-Language ko, captured
 * on 2026-10-24 (KST) after skkuverse-server 71d7c36b (PR 329) shipped, with
 * no festival live: the building map, lost and found and contact link chips
 * carry `tabs` map and transit, the building code chip `tabs` empty, and no
 * chip is a `layers` chip or carries `opensIn`. The wire still allows both, so
 * the last case appends a synthetic one to the served chips.
 *
 * The fixture is a snapshot, not a contract: a later chip change on the server
 * changes what production serves, and this file then needs a new capture, not
 * a looser assertion.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseOrThrow, setDropReporter } from '@skkuverse/shared';
import { chipsFor } from './chips.rules';
import { mapConfigSchema } from './map-config.schema';
import type { MapConfig } from './map-config.types';
import live from './__fixtures__/map-config-tabs-live.json';

const reports: [string, number][] = [];
setDropReporter((where, index) => reports.push([where, index]));
afterEach(() => {
  reports.length = 0;
});

const rowOf = (chips: MapConfig['chips']) => chips.map((c) => [c.id, c.label]);

describe('the live /map/config chip rows', () => {
  let config: MapConfig;
  beforeEach(() => {
    config = parseOrThrow(mapConfigSchema, live.data, 'map.config');
  });

  it('reads every served chip and reports no drop', () => {
    // Assert
    expect(config.chips.map((c) => c.id)).toEqual(live.data.chips.map((c) => c.id));
    expect(reports).toStrictEqual([]);
  });

  it('gives both of the shared shell’s tabs the building map, lost and found and contact, and hides the building code', () => {
    // Act
    const rows = { map: chipsFor('byTab', 'map', config.chips), transit: chipsFor('byTab', 'transit', config.chips) };

    // Assert
    const linkRow = [
      ['building_map', '건물지도'],
      ['lost_found', '분실물'],
      ['inquiry', '문의하기'],
    ];
    expect(rowOf(rows.map)).toEqual(linkRow);
    expect(rowOf(rows.transit)).toEqual(linkRow);
    expect(rows.transit.every((c) => c.action.kind === 'link' && c.opensIn === undefined)).toBe(true);
  });

  it('leaves the old shell’s one map tab as before the fields: every link chip, the building code included, and no layers chip', () => {
    // Act
    const row = chipsFor('all', 'map', config.chips);

    // Assert
    expect(row.map((c) => c.id)).toEqual(['building_map', 'building_code', 'lost_found', 'inquiry']);
  });

  it('still reads a layers chip with opensIn beside the served chips: on both shared rows, run in the map tab, and off the old shell’s row', () => {
    // Arrange: synthetic, in the wire shape the server used for its shuttle routes chip.
    const routeLines = {
      id: 'route_lines',
      label: '노선',
      icon: null,
      action: { kind: 'layers', layerIds: ['hssc_route'], camera: null },
      isReset: false,
      list: null,
      tabs: ['map', 'transit'],
      opensIn: 'map',
    };
    const withLayersChip = parseOrThrow(
      mapConfigSchema,
      { ...live.data, chips: [...live.data.chips, routeLines] },
      'map.config',
    );

    // Act
    const rows = {
      map: chipsFor('byTab', 'map', withLayersChip.chips),
      transit: chipsFor('byTab', 'transit', withLayersChip.chips),
      all: chipsFor('all', 'map', withLayersChip.chips),
    };

    // Assert
    expect(reports).toStrictEqual([]);
    expect(rows.map.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry', 'route_lines']);
    expect(rows.transit.map((c) => c.id)).toEqual(['building_map', 'lost_found', 'inquiry', 'route_lines']);
    expect(rows.transit.at(-1)?.opensIn).toBe('map');
    expect(rows.all.map((c) => c.id)).toEqual(['building_map', 'building_code', 'lost_found', 'inquiry']);
  });
});
