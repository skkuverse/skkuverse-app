/**
 * Layer visibility resolution. The resolution is five tiers and the layer's
 * own schedule is the LAST of them:
 *
 *     locked ?? stackLens ?? userToggle ?? tabDefault ?? defaultVisibleAt(layer, now)
 *
 * Every tier is a fallback rather than an assignment, which is the property that
 * lets the last one move with the clock: the moment a resolved value is written
 * down, the schedule underneath it is frozen and the user's own choice becomes
 * indistinguishable from the server's suggestion.
 *
 * The fixture mirrors the live `/map/config`: two building layers outside every
 * group, 주점 scheduled to the evening, 부스 to the day, 편의시설 opt-in, the
 * rest always on.
 */

import { describe, it, expect } from 'vitest';
import type { MapLayerDef } from './map-config.types';
import {
  defaultVisibleAt,
  isFestivalLayer,
  isLayerDimmed,
  isLayerVisible,
  tabDefaultLens,
  type LayerVisibilityInputs,
} from './layers.rules';

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



/**
 * Written with an explicit `+09:00` offset rather than a bare local string, so
 * the fixture means one instant whatever machine runs the suite.
 */
const NOON = Date.parse('2026-08-28T12:00:00+09:00');
const DUSK = Date.parse('2026-08-28T19:00:00+09:00');

/** The old two records, as the inputs the old callers pass: no tab default. */
const state = (
  overrides: Record<string, boolean> = {},
  chip: { id: string; visibility: Record<string, boolean> } | null = null,
): LayerVisibilityInputs => ({ stackLens: chip?.visibility ?? {}, userToggles: overrides, tabDefault: {} });


describe('isFestivalLayer — the discriminator', () => {
  it('reads a layer in a chip group as festival', () => {
    expect(isFestivalLayer(byId('eskara26_stage'))).toBe(true);
  });

  it('reads a layer in no chip group as permanent', () => {
    expect(isFestivalLayer(byId('building_numbers'))).toBe(false);
  });
});

describe('defaultVisibleAt — the last tier, and the only one that moves', () => {
  it('reads always and never as themselves, at any hour', () => {
    expect(defaultVisibleAt(byId('eskara26_stage'), NOON)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_stage'), DUSK)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_facility'), NOON)).toBe(false);
    expect(defaultVisibleAt(byId('eskara26_facility'), DUSK)).toBe(false);
  });

  it('splits 주점 and 부스 across the day — the whole point of the feature', () => {
    expect(defaultVisibleAt(byId('eskara26_booth'), NOON)).toBe(true);
    expect(defaultVisibleAt(byId('eskara26_bar'), NOON)).toBe(false);

    expect(defaultVisibleAt(byId('eskara26_booth'), DUSK)).toBe(false);
    expect(defaultVisibleAt(byId('eskara26_bar'), DUSK)).toBe(true);
  });

  it('reads an UNREADABLE declaration as off, not as on all day', () => {
    // The direction that matters. `null` is what the parser produces for a kind
    // this build cannot resolve, and reading it as "always" would draw 주점 at
    // noon the first time the server adds a kind — the exact crowding this axis
    // exists to remove. It is deliberately NOT the same as `{ kind: 'never' }`,
    // which is an authoring choice; this is "we could not tell".
    const unreadable = layer({ id: 'future', defaultVisibleWhen: null });
    expect(defaultVisibleAt(unreadable, NOON)).toBe(false);
    expect(defaultVisibleAt(unreadable, DUSK)).toBe(false);
  });

  it('reads a scheduled layer with no windows as off', () => {
    // Unreachable through the parser, which turns it into `null`. Asserted so
    // the belt holds if one is ever constructed by hand: `[].some()` is false,
    // and false is the direction that cannot light a layer nobody scheduled.
    const empty = layer({ id: 'x', defaultVisibleWhen: { kind: 'scheduled', windows: [] } });
    expect(defaultVisibleAt(empty, NOON)).toBe(false);
  });
});

describe('isLayerVisible — four tiers, in order', () => {
  it('falls through to the schedule when the user has said nothing', () => {
    expect(isLayerVisible(byId('eskara26_bar'), state(), NOON)).toBe(false);
    expect(isLayerVisible(byId('eskara26_bar'), state(), DUSK)).toBe(true);
  });

  it('lets the user override the schedule', () => {
    const on = state({ eskara26_bar: true });
    expect(isLayerVisible(byId('eskara26_bar'), on, NOON)).toBe(true);

    const off = state({ eskara26_booth: false });
    expect(isLayerVisible(byId('eskara26_booth'), off, NOON)).toBe(false);
  });

  it('lets a chip narrowing shadow the user override', () => {
    const narrowed = state(
      { eskara26_bar: true },
      { id: 'eskara26_view_stage', visibility: { eskara26_bar: false } },
    );
    expect(isLayerVisible(byId('eskara26_bar'), narrowed, NOON)).toBe(false);
  });

  it('leaves the override intact underneath, so dropping the chip restores it', () => {
    // The reported bug, at the resolution level: the chip SHADOWS, it does not
    // assign. `overrides` is byte-identical either side of the narrowing.
    const overrides = { eskara26_facility: true };
    const narrowed = state(overrides, {
      id: 'eskara26_view_bar',
      visibility: { eskara26_facility: false },
    });
    expect(isLayerVisible(byId('eskara26_facility'), narrowed, DUSK)).toBe(false);
    expect(isLayerVisible(byId('eskara26_facility'), state(overrides), DUSK)).toBe(true);
  });

  it('lets a forced layer outrank even a chip', () => {
    // `userConfigurable: false` puts a layer out of a chip's reach, not only the
    // filter sheet's. Inert today; asserted so it holds when it stops being.
    const locked = layer({ id: 'eskara26_stage', userConfigurable: false });
    const narrowed = state(
      { eskara26_stage: false },
      { id: 'c', visibility: { eskara26_stage: false } },
    );
    expect(isLayerVisible(locked, narrowed, NOON)).toBe(true);
  });

  it('ignores a chip entry for a different layer', () => {
    const narrowed = state({}, { id: 'c', visibility: { eskara26_stage: false } });
    expect(isLayerVisible(byId('eskara26_booth'), narrowed, NOON)).toBe(true);
  });
});


describe('isLayerVisible — the stack lens and the tab default', () => {
  const inputs = (over: Partial<LayerVisibilityInputs> = {}): LayerVisibilityInputs => ({
    stackLens: {},
    userToggles: {},
    tabDefault: {},
    ...over,
  });

  it('lets an open task draw a layer the user turned off', () => {
    const lens = inputs({ stackLens: { eskara26_bar: true }, userToggles: { eskara26_bar: false } });
    expect(isLayerVisible(byId('eskara26_bar'), lens, NOON)).toBe(true);
  });

  it('lets a user toggle outrank the tab default', () => {
    const lens = inputs({ userToggles: { eskara26_stage: true }, tabDefault: { eskara26_stage: false } });
    expect(isLayerVisible(byId('eskara26_stage'), lens, NOON)).toBe(true);
  });

  it('lets the tab default outrank the schedule', () => {
    expect(isLayerVisible(byId('eskara26_stage'), inputs({ tabDefault: { eskara26_stage: false } }), NOON)).toBe(
      false,
    );
    expect(isLayerVisible(byId('eskara26_bar'), inputs({ tabDefault: { eskara26_bar: true } }), NOON)).toBe(true);
  });

  it('keeps a locked layer on its schedule over every lens', () => {
    const locked = layer({ id: 'eskara26_stage', userConfigurable: false });
    const lens = inputs({
      stackLens: { eskara26_stage: false },
      userToggles: { eskara26_stage: false },
      tabDefault: { eskara26_stage: false },
    });
    expect(isLayerVisible(locked, lens, NOON)).toBe(true);
  });
});

describe('tabDefaultLens — a layer draws by default in the tabs it names', () => {
  const SERVED: MapLayerDef[] = [
    layer({ id: 'building_numbers', chipGroupId: null, tabs: ['map', 'transit'] }),
    layer({ id: 'eskara26_stage', tabs: ['map'] }),
    layer({ id: 'eskara26_bar' }),
    layer({ id: 'route_hssc', chipGroupId: null, tabs: ['transit'] }),
    layer({ id: 'retired', chipGroupId: null, tabs: [] }),
  ];

  it('hides in the transit tab every layer that leaves it out, an absent list included', () => {
    expect(tabDefaultLens('transit', SERVED)).toEqual({
      eskara26_stage: false,
      eskara26_bar: false,
      retired: false,
    });
  });

  it('hides the transit-only layers in the map tab', () => {
    expect(tabDefaultLens('map', SERVED)).toEqual({ route_hssc: false, retired: false });
  });

  it('changes nothing in the map tab for a config that predates the field', () => {
    expect(tabDefaultLens('map', LAYERS)).toEqual({});
  });

  it('leaves a kept layer to its schedule', () => {
    const lens = { stackLens: {}, userToggles: {}, tabDefault: tabDefaultLens('transit', SERVED) };
    const evening = layer({
      id: 'route_hssc',
      tabs: ['transit'],
      defaultVisibleWhen: { kind: 'scheduled', windows: [{ start: '18:00', end: '00:00' }] },
    });
    expect(isLayerVisible(evening, lens, NOON)).toBe(false);
    expect(isLayerVisible(evening, lens, DUSK)).toBe(true);
  });
});

describe('isLayerDimmed — an open task comes first (ADR 0022 rule 1)', () => {
  const lens = (stackLens: Record<string, boolean>, userToggles: Record<string, boolean> = {}) => ({
    stackLens,
    userToggles,
    tabDefault: {},
  });

  it('dims a shared layer while a dimming lens is open', () => {
    expect(isLayerDimmed(byId('building_numbers'), lens({ route_hssc: true }), true)).toBe(true);
  });

  it('never dims without a dimming lens', () => {
    expect(isLayerDimmed(byId('building_numbers'), lens({ route_hssc: true }), false)).toBe(false);
  });

  it('never dims a layer the task itself names', () => {
    expect(isLayerDimmed(byId('eskara26_bar'), lens({ eskara26_bar: true }), true)).toBe(false);
  });

  it('never dims a layer the user turned on', () => {
    expect(isLayerDimmed(byId('building_numbers'), lens({}, { building_numbers: true }), true)).toBe(false);
  });
});

