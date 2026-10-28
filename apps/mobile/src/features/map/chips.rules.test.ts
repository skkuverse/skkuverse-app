/**
 * The two contract rules a chip tap obeys, and where a chip runs.
 *
 * R1: `layerIds` means "within this group, set exactly these", NOT "turn these
 *     on". Named → on, unnamed sibling in the same group → off, everything
 *     outside the group → untouched. Reading it as "turn these on" is what
 *     would let a chip that jumps to a festival stage leave 주점 lit beside it,
 *     and reading it as "exclusive over everything" is what would turn 건물번호
 *     off underneath.
 *
 * R2: a `userConfigurable: false` layer is never changed by a chip. A chip tap
 *     is a user-initiated change, and that flag already answers who may make
 *     one. Inert today — nothing is false — and tested so it holds when that
 *     quadrant gets its first occupant.
 *
 * The fixture mirrors the live `/map/config`: two building layers outside every
 * group, 주점 scheduled to the evening, 부스 to the day, 편의시설 opt-in, the
 * rest always on.
 */

import { describe, it, expect } from 'vitest';
import { parseOrThrow, type ActionType } from '@skkuverse/shared';
import type { MapChip, MapChipCamera, MapLayerDef } from './map-config.types';
import { mapConfigSchema } from './map-config.schema';
import {
  chipMark,
  chipOfTap,
  chipRunsIn,
  chipsFor,
  chipsForTab,
  planChipRun,
  toChipLayers,
} from './chips.rules';
import { defaultVisibleAt, isLayerVisible, tabDefaultFor } from './layers.rules';

const CAMERA: MapChipCamera = {
  lat: 37.295129,
  lng: 126.971234,
  zoom: 17.5,
  tilt: 0,
  bearing: 0,
  durationMs: 500,
};

const layer = (over: Partial<MapLayerDef> & { id: string }): MapLayerDef => ({
  label: over.id,
  defaultVisibleWhen: { kind: 'always' },
  endpoint: '/map/overlays/event',
  chipGroupId: 'eskara-2026',
  userConfigurable: true,
  ...over,
});

const LAYERS: MapLayerDef[] = [
  layer({ id: 'building_numbers', chipGroupId: null, endpoint: '/map/overlays/campus' }),
  layer({ id: 'building_labels', chipGroupId: null, endpoint: '/map/overlays/campus' }),
  layer({ id: 'eskara26_stage' }),
  layer({
    id: 'eskara26_bar',
    defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '18:00', end: '00:00' }] },
  }),
  layer({ id: 'eskara26_food' }),
  layer({
    id: 'eskara26_booth',
    defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '11:00', end: '18:00' }] },
  }),
  layer({ id: 'eskara26_facility', defaultVisibleWhen: { kind: 'never' } }),
  layer({ id: 'eskara26_etc' }),
];

const byId = (id: string) => LAYERS.find((l) => l.id === id)!;

/** The five layers a reset chip is scoped to — everything not `never`. */
const DEFAULT_FESTIVAL_IDS = [
  'eskara26_stage',
  'eskara26_bar',
  'eskara26_food',
  'eskara26_booth',
  'eskara26_etc',
];

const focusChip = (id: string, layerIds: string[], isReset = false): MapChip => ({
  id,
  label: id,
  icon: { kind: 'emoji', emoji: '\u{1F3AA}' },
  action: { kind: 'focus', camera: CAMERA, layerIds },
  isReset,
  list: null,
});

const WEBVIEW_CHIP: MapChip = {
  id: 'lost_found',
  label: 'Lost & Found',
  icon: { kind: 'emoji', emoji: '\u{1F9F3}' },
  action: { kind: 'webview', url: 'https://webview.skkuverse.com/skku/lostandfound' },
  isReset: false,
  list: null,
};

const STAGE_CHIP = focusChip('eskara26_view_stage', ['eskara26_stage']);
const ALL_CHIP = focusChip('eskara-2026_all', DEFAULT_FESTIVAL_IDS, true);

/**
 * Written with an explicit `+09:00` offset rather than a bare local string, so
 * the fixture means one instant whatever machine runs the suite.
 */
const NOON = Date.parse('2026-08-28T12:00:00+09:00');
const DUSK = Date.parse('2026-08-28T19:00:00+09:00');

describe('toChipLayers — R1, exactly these within the group', () => {
  it('turns the named layer on and every unnamed sibling off', () => {
    const next = toChipLayers(STAGE_CHIP, LAYERS);
    expect(next).toEqual({
      eskara26_stage: true,
      eskara26_bar: false,
      eskara26_food: false,
      eskara26_booth: false,
      eskara26_facility: false,
      eskara26_etc: false,
    });
  });

  it('leaves a layer outside the group entirely absent from the result', () => {
    const next = toChipLayers(STAGE_CHIP, LAYERS);
    // Absent, not `false`: the write must not so much as mention 건물번호.
    expect(next).not.toHaveProperty('building_numbers');
    expect(next).not.toHaveProperty('building_labels');
  });

  it('turns the opt-in layer on when a chip names it', () => {
    const chip = focusChip('eskara26_view_facility', ['eskara26_facility']);
    expect(toChipLayers(chip, LAYERS)?.eskara26_facility).toBe(true);
  });

  it('returns null for a webview chip', () => {
    expect(toChipLayers(WEBVIEW_CHIP, LAYERS)).toBeNull();
  });

  it('returns null for the camera-only chip, whose layerIds are empty', () => {
    expect(toChipLayers(focusChip('camera_only', []), LAYERS)).toBeNull();
  });

  it('returns null when every named layer is one this build was not served', () => {
    expect(toChipLayers(focusChip('c', ['eskara27_stage']), LAYERS)).toBeNull();
  });

  it('ignores an unserved id but still resolves the group from a served one', () => {
    const chip = focusChip('c', ['eskara27_ghost', 'eskara26_bar']);
    const next = toChipLayers(chip, LAYERS);
    expect(next?.eskara26_bar).toBe(true);
    expect(next).not.toHaveProperty('eskara27_ghost');
  });

  it('refuses to resolve a group off a chipGroupId-null layer', () => {
    // The building layers exist to exercise this: no chip may ever change them,
    // so naming one resolves no group at all rather than an "ungrouped" one.
    expect(toChipLayers(focusChip('c', ['building_numbers']), LAYERS)).toBeNull();
  });
});

describe('toChipLayers — R2, a locked layer is never written', () => {
  it('skips a userConfigurable:false sibling instead of switching it off', () => {
    const locked = LAYERS.map((l) =>
      l.id === 'eskara26_etc' ? { ...l, userConfigurable: false } : l,
    );
    const next = toChipLayers(STAGE_CHIP, locked);
    expect(next).not.toHaveProperty('eskara26_etc');
    expect(next?.eskara26_bar).toBe(false);
  });

  it('skips a userConfigurable:false layer even when the chip names it', () => {
    const locked = LAYERS.map((l) =>
      l.id === 'eskara26_stage' ? { ...l, userConfigurable: false } : l,
    );
    expect(toChipLayers(STAGE_CHIP, locked)).not.toHaveProperty('eskara26_stage');
  });
});

describe('the reset chip is declared, not derived', () => {
  it('carries isReset while an authored narrowing chip does not', () => {
    // What replaced `findNarrowedChip`'s comparison. The reset chip's layerIds
    // used to be recognisable as "the default view"; with a schedule that view
    // depends on the hour, so at 19:00 the comparison stopped answering.
    expect(ALL_CHIP.isReset).toBe(true);
    expect(STAGE_CHIP.isReset).toBe(false);
    expect(WEBVIEW_CHIP.isReset).toBe(false);
  });

  it('names a set that is NOT the default view at every hour', () => {
    // The concrete reason the flag exists. 부스 is in the reset chip's layerIds
    // and is off by default at 19:00, so applying the narrowing rule to a reset
    // tap would turn it on — and 주점 off — which is backwards.
    expect(ALL_CHIP.action.kind === 'focus' && ALL_CHIP.action.layerIds).toContain(
      'eskara26_booth',
    );
    expect(defaultVisibleAt(byId('eskara26_booth'), DUSK)).toBe(false);
  });
});

describe('chips per tab (ADR 0022 d1)', () => {
  const LINK_CHIP: MapChip = {
    ...WEBVIEW_CHIP,
    id: 'building_map',
    action: { kind: 'link', actionType: 'route', actionValue: '/building-map' },
  };
  const linkTo = (actionType: ActionType): MapChip => ({
    ...LINK_CHIP,
    action: { kind: 'link', actionType, actionValue: 'x' },
  });

  const ROUTE_LINES: MapChip = { ...STAGE_CHIP, id: 'route_lines', tabs: ['transit'] };
  const BOTH: MapChip = { ...LINK_CHIP, id: 'contact', tabs: ['map', 'transit'] };
  const FESTIVAL_FROM_TRANSIT: MapChip = { ...STAGE_CHIP, tabs: ['map', 'transit'], opensIn: 'map' };

  it('shows a chip without tabs in the map tab only, as installed builds do', () => {
    const chips = [STAGE_CHIP, WEBVIEW_CHIP, LINK_CHIP];
    expect(chipsForTab(chips, 'map')).toEqual(chips);
    expect(chipsForTab(chips, 'transit')).toEqual([]);
  });

  it('shows a chip in the tabs it names', () => {
    const chips = [STAGE_CHIP, ROUTE_LINES, BOTH];
    expect(chipsForTab(chips, 'map')).toEqual([STAGE_CHIP, BOTH]);
    expect(chipsForTab(chips, 'transit')).toEqual([ROUTE_LINES, BOTH]);
  });

  it('shows a chip with an empty tabs list in no tab, unlike one with none', () => {
    // The parser keeps `[]` when every served tab id is one this build lacks:
    // the chip belongs to a tab that does not exist here, not to the map tab.
    const retired: MapChip = { ...STAGE_CHIP, id: 'retired', tabs: [] };
    expect(chipsForTab([retired, STAGE_CHIP], 'map')).toEqual([STAGE_CHIP]);
    expect(chipsForTab([retired], 'transit')).toEqual([]);
  });

  it('runs a chip whose result is on the map in the map tab, wherever it was tapped (owner, 2026-10-24)', () => {
    expect(chipRunsIn(STAGE_CHIP)).toBe('map');
    expect(chipRunsIn(ROUTE_LINES)).toBe('map');
    expect(chipRunsIn(FESTIVAL_FROM_TRANSIT)).toBe('map');
  });

  it('marks a map chip › in the transit row, where it switches to the map tab, and nothing in the map row', () => {
    expect(chipMark(FESTIVAL_FROM_TRANSIT, 'transit')).toBe('moves');
    expect(chipMark(ROUTE_LINES, 'transit')).toBe('moves');
    expect(chipMark(FESTIVAL_FROM_TRANSIT, 'map')).toBeNull();
  });

  it('keeps a chip with opensIn transit for the transit list, marked › from the map row only', () => {
    // Arrange
    const filter: MapChip = { ...STAGE_CHIP, id: 'running_now', tabs: ['transit'], opensIn: 'transit' };

    // Act
    const where = [chipRunsIn(filter), chipMark(filter, 'transit'), chipMark(filter, 'map')];

    // Assert
    expect(where).toEqual(['transit', null, 'moves']);
  });

  it('marks a chip that leaves the app with ↗', () => {
    expect(chipMark(WEBVIEW_CHIP, 'map')).toBe('leaves');
    expect(chipMark(linkTo('webview'), 'map')).toBe('leaves');
    expect(chipMark(linkTo('external'), 'map')).toBe('leaves');
    expect(chipMark(linkTo('miniapp'), 'map')).toBe('leaves');
  });

  it('marks a chip that opens an in-app page with ›', () => {
    expect(chipMark(linkTo('route'), 'map')).toBe('moves');
    expect(chipMark(linkTo('map'), 'map')).toBe('moves');
  });

  it('marks nothing on a chip that runs where it was tapped, or goes nowhere', () => {
    expect(chipMark(STAGE_CHIP, 'map')).toBeNull();
    expect(chipMark(linkTo('content'), 'map')).toBeNull();
    expect(chipMark(linkTo('unknown'), 'map')).toBeNull();
  });
});

describe('the shell decides what the focused tab sees of `tabs` (server contract §8.9)', () => {
  // The shapes the transit tab's map brings: a route layer for the transit
  // tab and a `layers` chip over it (no base chip is one today, but the wire
  // allows it), beside the ordinary building and festival layers. Installed
  // builds drop the `layers` action, so the native-tab shell leaves the chip
  // out of its chip row.
  const config = parseOrThrow(
    mapConfigSchema,
    {
      layers: [
        { id: 'building_numbers', label: '건물번호', defaultVisibleWhen: { kind: 'always' }, endpoint: '/map/overlays/campus' },
        {
          id: 'hssc_route',
          label: '인사캠 셔틀',
          defaultVisibleWhen: { kind: 'always' },
          endpoint: '/map/overlays/transit',
          tabs: ['transit'],
        },
      ],
      chips: [
        {
          id: 'eskara26_view_stage',
          label: '공연',
          icon: null,
          action: { kind: 'focus', camera: { ...CAMERA, durationMs: 500 }, layerIds: ['eskara26_stage'] },
        },
        {
          id: 'route_lines',
          label: '셔틀 노선',
          icon: null,
          action: { kind: 'layers', layerIds: ['hssc_route'], camera: null },
          tabs: ['transit'],
        },
        { id: 'building_map', label: '건물지도', icon: null, action: { kind: 'link', actionType: 'route', actionValue: '/map/hssc' } },
      ],
    },
    'map.config',
  );
  const route = config.layers.find((l) => l.id === 'hssc_route')!;

  it('the native-tab campus tab ignores tabs: every served layer resolves by its own default, and every accepted chip shows', () => {
    const inputs = { stackLens: {}, userToggles: {}, tabDefault: tabDefaultFor('all', 'map', config.layers) };
    expect(inputs.tabDefault).toEqual({});
    expect(isLayerVisible(route, inputs, NOON)).toBe(true);
    expect(chipsFor('all', 'map', config.chips).map((c) => c.id)).toEqual(['eskara26_view_stage', 'building_map']);
  });

  it('the shared-map shell lenses by tab: the route is off in the map tab and on in transit', () => {
    const map = { stackLens: {}, userToggles: {}, tabDefault: tabDefaultFor('byTab', 'map', config.layers) };
    const transit = { stackLens: {}, userToggles: {}, tabDefault: tabDefaultFor('byTab', 'transit', config.layers) };
    expect(isLayerVisible(route, map, NOON)).toBe(false);
    expect(isLayerVisible(route, transit, NOON)).toBe(true);
    expect(chipsFor('byTab', 'map', config.chips).map((c) => c.id)).toEqual(['eskara26_view_stage', 'building_map']);
    expect(chipsFor('byTab', 'transit', config.chips).map((c) => c.id)).toEqual(['route_lines']);
  });
});

describe('the layers chip: exactly these layers on, no group (ADR 0022 d1)', () => {
  const ROUTES: MapLayerDef[] = [
    layer({ id: 'jongro02_route', chipGroupId: null, endpoint: '/map/overlays/transit', defaultVisibleWhen: { kind: 'never' }, tabs: ['transit'] }),
    layer({ id: 'hssc_route', chipGroupId: null, endpoint: '/map/overlays/transit', defaultVisibleWhen: { kind: 'never' }, tabs: ['transit'] }),
  ];
  const WITH_ROUTES = [...LAYERS, ...ROUTES];
  const layersChip = (layerIds: string[], over: Partial<MapChip> = {}): MapChip => ({
    id: 'route_lines',
    label: '셔틀 노선',
    icon: null,
    action: { kind: 'layers', layerIds, camera: null },
    isReset: false,
    list: null,
    tabs: ['transit'],
    ...over,
  });

  it('turns on every named layer and mentions no other', () => {
    // Act
    const next = toChipLayers(layersChip(['jongro02_route', 'hssc_route']), WITH_ROUTES);

    // Assert
    expect(next).toEqual({ jongro02_route: true, hssc_route: true });
  });

  it('leaves out a named layer this config does not serve, and a locked one', () => {
    // Arrange
    const layers = [...WITH_ROUTES.filter((l) => l.id !== 'hssc_route'), layer({ id: 'locked_route', chipGroupId: null, userConfigurable: false })];

    // Act
    const next = toChipLayers(layersChip(['jongro02_route', 'hssc_route', 'locked_route']), layers);

    // Assert
    expect(next).toEqual({ jongro02_route: true });
  });

  it('sets nothing when no layer it names is served', () => {
    expect(toChipLayers(layersChip(['gone_route']), WITH_ROUTES)).toBeNull();
  });

  it('marks › in the transit row, where it switches to the map tab, and nothing in the map row', () => {
    // Arrange
    const served = layersChip(['hssc_route'], { tabs: ['map', 'transit'], opensIn: 'map' });

    // Act
    const marks = [chipMark(layersChip(['hssc_route']), 'transit'), chipMark(served, 'transit'), chipMark(served, 'map')];

    // Assert
    expect(marks).toEqual(['moves', 'moves', null]);
  });

  it('is never in the native-tab campus tab, whose chip row is what installed builds show', () => {
    // Arrange
    const chips = [STAGE_CHIP, layersChip(['hssc_route']), WEBVIEW_CHIP];

    // Act
    const shown = chipsFor('all', 'map', chips);

    // Assert
    expect(shown).toEqual([STAGE_CHIP, WEBVIEW_CHIP]);
  });

  it('keeps the chip row by identity where there is no layers chip to leave out', () => {
    const chips = [STAGE_CHIP, WEBVIEW_CHIP];
    expect(chipsFor('all', 'map', chips)).toBe(chips);
  });

  it('is not reachable from an overlay tap where the chip row leaves it out', () => {
    // Arrange
    const routeLines = layersChip(['hssc_route']);
    const chips = [STAGE_CHIP, routeLines];

    // Act
    const tapped = [
      chipOfTap('all', 'map', chips, 'route_lines'),
      chipOfTap('byTab', 'map', chips, 'route_lines'),
      chipOfTap('byTab', 'transit', chips, 'route_lines'),
      chipOfTap('all', 'map', chips, STAGE_CHIP.id),
      chipOfTap('all', 'map', chips, 'gone'),
    ];

    // Assert
    expect(tapped).toEqual([null, null, routeLines, STAGE_CHIP, null]);
  });
});

describe('planChipRun: where a chip runs and what it writes there', () => {
  const ROUTE = layer({ id: 'hssc_route', chipGroupId: null, endpoint: '/map/overlays/transit', tabs: ['transit'] });
  const ROUTE_LINES: MapChip = {
    id: 'route_lines',
    label: '셔틀 노선',
    icon: null,
    action: { kind: 'layers', layerIds: ['hssc_route'], camera: null },
    isReset: false,
    list: null,
    tabs: ['transit'],
  };
  const FESTIVAL_FROM_TRANSIT: MapChip = { ...STAGE_CHIP, tabs: ['map', 'transit'], opensIn: 'map' };

  it('opens a page rather than running on the map for a webview or link chip', () => {
    // Arrange
    const link: MapChip = { ...WEBVIEW_CHIP, action: { kind: 'link', actionType: 'route', actionValue: '/building-map' } };

    // Act
    const runs = [planChipRun(WEBVIEW_CHIP, 'map', 'byTab', LAYERS), planChipRun(link, 'map', 'byTab', LAYERS)];

    // Assert
    expect(runs).toEqual([null, null]);
  });

  it('turns a chip on in the map tab where it was tapped there, replacing a chip on top, and lowers the sheet to its result', () => {
    // Act
    const run = planChipRun(ROUTE_LINES, 'map', 'byTab', [...LAYERS, ROUTE]);

    // Assert
    expect(run).toEqual({
      kind: 'map',
      task: {
        type: 'select',
        request: { kind: 'chip', chipId: 'route_lines' },
        key: 'chip:route_lines',
        layers: { hssc_route: true },
        detent: 'min',
      },
      camera: null,
      reveal: true,
    });
  });

  it('runs a chip tapped on the transit row in the map tab, pushed on top of what that tab has open', () => {
    // Act
    const run = planChipRun(ROUTE_LINES, 'transit', 'byTab', [...LAYERS, ROUTE]);

    // Assert
    expect(run).toEqual({
      kind: 'map',
      task: {
        type: 'push',
        request: { kind: 'chip', chipId: 'route_lines' },
        key: 'chip:route_lines',
        layers: { hssc_route: true },
        detent: 'min',
      },
      camera: null,
      reveal: true,
    });
  });

  it('leaves the sheet to the list for a chip that lists event places', () => {
    // Act
    const run = planChipRun(FESTIVAL_FROM_TRANSIT, 'transit', 'byTab', LAYERS);

    // Assert
    expect(run).toMatchObject({
      kind: 'map',
      task: { type: 'push', request: { kind: 'chip', chipId: STAGE_CHIP.id }, detent: 'mid' },
      camera: CAMERA,
      reveal: false,
    });
  });

  it('keeps a chip with opensIn transit off the map, as a transit list filter', () => {
    // Act
    const run = planChipRun({ ...STAGE_CHIP, opensIn: 'transit' }, 'transit', 'byTab', LAYERS);

    // Assert
    expect(run).toEqual({ kind: 'transitFilter', chipId: STAGE_CHIP.id });
  });

  it('runs every chip in the map tab and lowers nothing on the native-tab shell, which ignores opensIn', () => {
    // Act
    const runs = [
      planChipRun({ ...STAGE_CHIP, opensIn: 'transit' }, 'map', 'all', LAYERS),
      planChipRun(focusChip('camera_only', []), 'map', 'all', LAYERS),
    ];

    // Assert
    expect(runs[0]).toMatchObject({ kind: 'map', task: { type: 'select' }, reveal: false });
    expect(runs[1]).toEqual({ kind: 'map', task: null, camera: CAMERA, reveal: false });
  });

  it('releases the chip for a reset chip, and still moves the camera', () => {
    // Act
    const run = planChipRun(ALL_CHIP, 'map', 'byTab', LAYERS);

    // Assert
    expect(run).toEqual({ kind: 'map', task: { type: 'releaseChip' }, camera: CAMERA, reveal: false });
  });

  it('writes no entry for a chip that resolves no layers, moves the camera and lowers the sheet to it', () => {
    // Act
    const run = planChipRun(focusChip('camera_only', []), 'map', 'byTab', LAYERS);

    // Assert
    expect(run).toEqual({ kind: 'map', task: null, camera: CAMERA, reveal: true });
  });
});
