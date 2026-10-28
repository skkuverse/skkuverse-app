/**
 * Map state — what the user expressed, and the chip laid over it.
 *
 * The store holds no resolved visibility at all any more. It used to, seeded
 * from each layer's `defaultVisible`, and the two bugs that followed are the
 * reason this suite exists in its current shape:
 *
 *  - A default that varies with the clock could never reach the screen, because
 *    the value written at 11:00 was recorded as if the user had chosen it.
 *  - Clearing a chip could only restore the SERVER's defaults, because the
 *    user's own choices had been overwritten by the chip's group write.
 *
 * `isLayerVisible` resolves the two records this holds against a layer's own
 * schedule; the tests for that live in `layers.rules.test.ts`. What is
 * asserted here is narrower and is the half that was broken: a chip SHADOWS and
 * never assigns, so dropping it gives the user back exactly what they had.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mapChipLinkQueue, mapPlaceLinkQueue, useMapNavStore, useMapStore } from './map.store';
import { EMPTY_TASK, activeChip, topEntry } from './map-task.rules';

// Native module — importing it in Node fails outright. The settings store this
// one seeds `selectedCampus` from reaches MMKV at module load.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

/** What a chip tap over the festival group resolves to — 주점 alone. */
const BAR_ONLY = {
  eskara26_stage: false,
  eskara26_bar: true,
  eskara26_facility: false,
};

const store = () => useMapStore.getState();

/** A chip tap in the map tab, the write the campus screen makes. */
const setChip = (id: string, visibility: Record<string, boolean>) =>
  store().dispatchTask('map', {
    type: 'select',
    request: { kind: 'chip', chipId: id },
    key: `chip:${id}`,
    layers: visibility,
    detent: 'mid',
  });
const clearChip = () => store().dispatchTask('map', { type: 'releaseChip' });
/** The map tab's chip, in the shape this suite has always asserted. */
const chip = () => {
  const c = activeChip(store().tasks.map);
  return c && { id: c.request.chipId, visibility: c.layers };
};

beforeEach(() => {
  useMapStore.setState({
    overrides: {},
    tasks: { map: EMPTY_TASK, transit: EMPTY_TASK },
    activeTab: 'map',
    suggestionsSilenced: false,
  });
});

describe('a fresh store has no opinion about anything', () => {
  it('starts with no overrides and no chip', () => {
    // Not "everything hidden" and not "everything at its default" — nothing is
    // recorded at all, which is what leaves `defaultVisibleAt` free to answer
    // and to keep answering differently as the clock moves.
    expect(store().overrides).toEqual({});
    expect(chip()).toBeNull();
  });
});

describe('setChip — a narrowing that shadows rather than assigns', () => {
  it('records the tap without touching what the user chose', () => {
    store().setLayerOverride('eskara26_facility', true);
    setChip('eskara26_view_bar', BAR_ONLY);

    expect(chip()).toEqual({ id: 'eskara26_view_bar', visibility: BAR_ONLY });
    expect(store().overrides.eskara26_facility).toBe(true);
  });

  it('replaces one narrowing with the next rather than merging them', () => {
    setChip('eskara26_view_bar', BAR_ONLY);
    setChip('eskara26_view_stage', { eskara26_stage: true, eskara26_bar: false });

    expect(chip()?.id).toBe('eskara26_view_stage');
    expect(chip()?.visibility).toEqual({
      eskara26_stage: true,
      eskara26_bar: false,
    });
  });
});

describe('clearChip — 편의시설 comes back on', () => {
  it('restores what the user had, not what the server ships', () => {
    // The reported bug, end to end at the store level. Check 편의시설 on, tap
    // 주점, clear — and 편의시설 must still be on. It used to come back OFF,
    // because the clear control wrote each layer's `defaultVisible` and 편의시설
    // ships hidden.
    store().setLayerOverride('eskara26_facility', true);
    setChip('eskara26_view_bar', BAR_ONLY);
    clearChip();

    expect(chip()).toBeNull();
    expect(store().overrides.eskara26_facility).toBe(true);
  });

  it('leaves a layer the user never touched with no entry at all', () => {
    // So it returns to its own schedule rather than to a boolean captured on the
    // way in. An entry here would be the freeze this whole shape avoids.
    setChip('eskara26_view_bar', BAR_ONLY);
    clearChip();

    expect(store().overrides).not.toHaveProperty('eskara26_bar');
    expect(store().overrides).not.toHaveProperty('eskara26_stage');
  });

  it('is a no-op when nothing was narrowed', () => {
    store().setLayerOverride('eskara26_bar', false);
    clearChip();
    expect(store().overrides).toEqual({ eskara26_bar: false });
  });
});

describe('setLayerOverride — a hand edit takes the view as it stands', () => {
  it('records exactly what it was asked for', () => {
    store().setLayerOverride('eskara26_bar', false);
    expect(store().overrides.eskara26_bar).toBe(false);
  });

  it('commits the active chip before writing, so nothing else jumps', () => {
    // Toggling one tile while narrowed drops the strip. If the chip's values
    // were not folded into `overrides` first, every OTHER layer in the group
    // would snap back to its schedule at the same moment — the map undoing
    // something the user did not ask it to.
    setChip('eskara26_view_bar', BAR_ONLY);
    store().setLayerOverride('eskara26_facility', true);

    expect(chip()).toBeNull();
    expect(store().overrides).toEqual({ ...BAR_ONLY, eskara26_facility: true });
  });

  it('lets the tapped layer win over the chip value it is committing', () => {
    // 주점 is on in the narrowing; switching it off has to survive the commit
    // rather than being overwritten by the value being folded in beside it.
    setChip('eskara26_view_bar', BAR_ONLY);
    store().setLayerOverride('eskara26_bar', false);

    expect(store().overrides.eskara26_bar).toBe(false);
  });

  it('accepts an id no config served, because nothing is seeded any more', () => {
    // The old store refused an unknown id, since minting an entry would shadow
    // a real layer's default the day the server started serving one. There is
    // nothing to shadow now: an override is only ever consulted for a layer the
    // config lists, so a stale id is inert rather than dangerous.
    store().setLayerOverride('eskara27_ghost', true);
    expect(store().overrides.eskara27_ghost).toBe(true);
  });
});

describe('one task per tab', () => {
  it('starts both tabs with an empty stack', () => {
    expect(store().tasks).toEqual({ map: EMPTY_TASK, transit: EMPTY_TASK });
  });

  it('writes only the tab it is dispatched to', () => {
    store().dispatchTask('transit', {
      type: 'push',
      request: { kind: 'line', groupId: 'hssc', source: 'tab' },
      key: 'line:hssc',
      layers: {},
      detent: 'max',
    });

    expect(topEntry(store().tasks.transit)?.request).toEqual({ kind: 'line', groupId: 'hssc', source: 'tab' });
    expect(store().tasks.map).toBe(EMPTY_TASK);
  });

  it('keeps the tasks object when an action changes nothing', () => {
    const before = store().tasks;
    store().dispatchTask('map', { type: 'pop' });
    expect(store().tasks).toBe(before);
  });
});

describe('setLayerOverride releases the focused tab\'s chip alone', () => {
  it('leaves the other tab\'s chip on', () => {
    store().dispatchTask('transit', {
      type: 'select',
      request: { kind: 'chip', chipId: 'shuttles' },
      key: 'chip:shuttles',
      layers: { route_hssc: true },
      detent: 'mid',
    });
    setChip('eskara26_view_bar', BAR_ONLY);

    store().setLayerOverride('eskara26_facility', true);

    expect(chip()).toBeNull();
    expect(activeChip(store().tasks.transit)?.request.chipId).toBe('shuttles');
    expect(store().overrides).toEqual({ ...BAR_ONLY, eskara26_facility: true });
  });

  it('keeps a sheet open above the chip', () => {
    setChip('eskara26_view_bar', BAR_ONLY);
    store().dispatchTask('map', {
      type: 'push',
      request: { kind: 'event', placeId: 'eskara26-bar-1', source: 'pin' },
      key: 'event:eskara26-bar-1',
      layers: {},
      detent: 'min',
    });

    store().setLayerOverride('eskara26_bar', false);

    expect(store().tasks.map.stack.map((e) => e.request.kind)).toEqual(['event']);
  });
});

describe('the session silence and the focused tab', () => {
  it('starts unsilenced and silences on a toggle pick', () => {
    expect(store().suggestionsSilenced).toBe(false);
    store().silenceSuggestions();
    expect(store().suggestionsSilenced).toBe(true);
  });

  it('starts on the map tab and follows the shell', () => {
    expect(store().activeTab).toBe('map');
    store().setActiveTab('transit');
    expect(store().activeTab).toBe('transit');
  });
});

describe('the place link queue', () => {
  beforeEach(() => {
    mapPlaceLinkQueue.consume('map');
    mapPlaceLinkQueue.consume('transit');
  });

  it('hands a link to the tab it names, once, and keeps it from the other tab', () => {
    // Arrange
    mapPlaceLinkQueue.set({ kind: 'bus_stop', placeId: 'seoul-01592', tab: 'transit' });

    // Act & Assert
    expect(mapPlaceLinkQueue.consume('map')).toBeNull();
    expect(mapPlaceLinkQueue.consume('transit')).toStrictEqual({ kind: 'bus_stop', placeId: 'seoul-01592', tab: 'transit' });
    expect(mapPlaceLinkQueue.consume('transit')).toBeNull();
  });

  it('tells a subscriber on every set', () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = mapPlaceLinkQueue.subscribe(listener);

    // Act
    mapPlaceLinkQueue.set({ kind: null, placeId: 'booth-1', tab: 'map' });
    unsubscribe();
    mapPlaceLinkQueue.set({ kind: null, placeId: 'booth-2', tab: 'map' });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the chip link queue', () => {
  beforeEach(() => {
    mapChipLinkQueue.consume();
  });

  it('hands the last chip link out once', () => {
    // Arrange
    mapChipLinkQueue.set({ chipId: 'first', source: 'deeplink' });
    mapChipLinkQueue.set({ chipId: 'eskara_food', source: 'push' });

    // Act & Assert
    expect(mapChipLinkQueue.consume()).toStrictEqual({ chipId: 'eskara_food', source: 'push' });
    expect(mapChipLinkQueue.consume()).toBeNull();
  });

  it('tells a subscriber on every set', () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = mapChipLinkQueue.subscribe(listener);

    // Act
    mapChipLinkQueue.set({ chipId: 'a', source: 'deeplink' });
    unsubscribe();
    mapChipLinkQueue.set({ chipId: 'b', source: 'deeplink' });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the search hand-off', () => {
  const PAYLOAD = { kind: 'building', skkuId: 101, tab: 'transit' } as const;

  beforeEach(() => {
    useMapNavStore.getState().consumePendingNavPayload('map');
    useMapNavStore.getState().consumePendingNavPayload('transit');
  });

  it('hands a building to the tab beneath the search, once, and keeps it from the other tab', () => {
    // Arrange
    useMapNavStore.getState().setPendingNavPayload(PAYLOAD);

    // Act & Assert
    expect(useMapNavStore.getState().consumePendingNavPayload('map')).toBeNull();
    expect(useMapNavStore.getState().consumePendingNavPayload('transit')).toStrictEqual(PAYLOAD);
    expect(useMapNavStore.getState().consumePendingNavPayload('transit')).toBeNull();
  });
});
