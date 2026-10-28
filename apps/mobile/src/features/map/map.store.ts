/**
 * WHY: the layer half holds only what the user expressed, never resolved visibility: a seeded value froze the
 * clock's defaults and let a chip clear wipe the user's choices. A chip is an entry on its tab's stack, so
 * releasing it writes nothing. Never persisted: a sheet reopening at launch on yesterday's booth is wrong.
 */

import { create } from 'zustand';
import { createPendingSlot, useSettingsStore, type Campus, type PlaceKind } from '@skkuverse/shared';
import type { ChipSource } from '@/platform/analytics.types';
import type { EntrySource } from '@/platform/analytics.rules';
import { devLog } from '@/platform/dev-log';
import type { MapNavPayload } from '@/features/map/building/building.types';
import { EMPTY_TASK, activeChip, reduceMapTask, type MapTaskAction } from './map-task.rules';
import type { MapTabId } from './map-config.types';
import type { MapTaskState, PageOrigin } from './sheet-stack.types';

interface MapWorldState {
  selectedCampus: Campus;
  /** WHY: never seeded, so an absent id lets the schedule answer, and a layer the server stops serving leaves no entry. */
  overrides: Record<string, boolean>;
  /** WHY: session-scoped on purpose: it is about this sitting, not a preference (ADR 0008 §3). */
  suggestionsSilenced: boolean;
  activeTab: MapTabId;
}

interface MapStoreActions {
  /**
   * WHY: commits the active chip's narrowing into `overrides` and releases the chip first, so a hand edit keeps
   * what is on screen instead of snapping the group back.
   */
  setLayerOverride: (id: string, visible: boolean) => void;
  setSelectedCampus: (id: Campus) => void;
  /** WHY: a locate is a newer explicit request and is never silenced. */
  silenceSuggestions: () => void;
  setActiveTab: (tab: MapTabId) => void;
  dispatchTask: (tab: MapTabId, action: MapTaskAction) => void;
}

export type MapStore = MapWorldState & {
  tasks: Readonly<Record<MapTabId, MapTaskState>>;
} & MapStoreActions;

export const useMapStore = create<MapStore>((set) => ({
  selectedCampus: useSettingsStore.getState().preferredCampus,
  overrides: {},
  suggestionsSilenced: false,
  activeTab: 'map',
  tasks: { map: EMPTY_TASK, transit: EMPTY_TASK },

  setLayerOverride: (id, visible) => {
    set((state) => {
      const task = state.tasks[state.activeTab];
      const chip = activeChip(task);
      return {
        // WHY: the chip's resolution folds in first, so its layers keep the values they are shown with.
        overrides: { ...state.overrides, ...(chip?.layers ?? {}), [id]: visible },
        // WHY: a hand edit means no chip describes the map, which takes the active-chip strip down.
        tasks: chip
          ? { ...state.tasks, [state.activeTab]: reduceMapTask(task, { type: 'releaseChip' }) }
          : state.tasks,
      };
    });
  },

  setSelectedCampus: (id) => {
    set({ selectedCampus: id });
    useSettingsStore.getState().setPreferredCampus(id);
  },

  silenceSuggestions: () => {
    set({ suggestionsSilenced: true });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  dispatchTask: (tab, action) => {
    set((state) => {
      const next = reduceMapTask(state.tasks[tab], action);
      return next === state.tasks[tab] ? state : { tasks: { ...state.tasks, [tab]: next } };
    });
  },
}));

/**
 * QUIRK(expo-router): `router.back()` returns no data, so search sets a pending building here and the named
 * tab's ViewModel reads and clears it.
 */
interface MapNavState {
  pendingNavPayload: MapNavPayload | null;
  setPendingNavPayload: (payload: MapNavPayload) => void;
  /** WHY: read-and-clear in one call, so a payload cannot be consumed twice; only the named tab reads it. */
  consumePendingNavPayload: (tab: MapTabId) => MapNavPayload | null;
}

export const useMapNavStore = create<MapNavState>((set, get) => ({
  pendingNavPayload: null,

  setPendingNavPayload: (payload) => set({ pendingNavPayload: payload }),

  consumePendingNavPayload: (tab) => {
    const current = get().pendingNavPayload;
    if (!current || current.tab !== tab) return null;
    set({ pendingNavPayload: null });
    return current;
  },
}));

// WHY: `+native-intent.tsx` runs outside the React tree but shares this module's state. No root-layout consumer:
// only a map tab can resolve a placeId, and `redirectSystemPath` already made it the destination.
//
//
/**
 * WHY: `null` for a bare `?place=<id>`, which has only ever addressed an event place; `<kind>:<placeId>` is
 * literally a marker's `tap`, so a link cannot disagree with its marker.
 */
type PendingMapPlaceLink = {
  kind: PlaceKind | null;
  placeId: string;
  source?: EntrySource;
  tab: MapTabId;
  origin?: PageOrigin;
};

const mapPlaceLinkSlot = createPendingSlot<PendingMapPlaceLink>({
  name: 'pendingMapPlace',
  log: devLog,
  describe: (p) => ({ kind: p.kind, placeId: p.placeId, tab: p.tab }),
});

export const mapPlaceLinkQueue = {
  set: mapPlaceLinkSlot.set,
  /** WHY: a link for the other tab stays for its consumer. */
  consume: (tab: MapTabId): PendingMapPlaceLink | null => mapPlaceLinkSlot.consume((p) => p.tab === tab),
  subscribe: mapPlaceLinkSlot.subscribe,
};

/** WHY: one slot, like the place link: a newer link replaces an unread one. */
export const mapChipLinkQueue = createPendingSlot<{ chipId: string; source: ChipSource }>({
  name: 'pendingMapChip',
  log: devLog,
  describe: (link) => ({ chipId: link.chipId, source: link.source }),
});
