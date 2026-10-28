import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStateStorage } from './mmkv-storage';

import type { Campus } from '../utils/campus.constants';
import type { SubwayChoice, SubwayDirectionKey } from '../utils/subway-line.types';
// WHY: Campus lives in campus.constants.ts so pure parsers use it without pulling zustand and
// react-native into a vitest run.
export { CAMPUSES, type Campus } from '../utils/campus.constants';

export type AppLanguage = 'ko' | 'en' | 'zh';

// WHY: a route name outlives its tab's label (`home` holds the mini apps): deep links, a saved `lastTab` and
// past analytics events carry it.
export type TabRoute = 'home' | 'campus' | 'transit' | 'notices';

/**
 * WHY: nothing reads the `eskara*` keys; they stay so the flags installs persisted keep a valid type, and
 * a later campaign takes a new key rather than reuse one. `intro` is not `onboardingCompleted`, which gates
 * the notices tab.
 */
export type SeenKey = 'intro' | 'eskaraWhatsNew' | 'eskaraMapPromo' | 'eskaraPushAsk';


export type TransitGroupState = 'collapsed' | 'expanded';

export interface SettingsState {
  preferredCampus: Campus;
  appLanguage: AppLanguage;
  lastTab: TabRoute;
  onboardingCompleted: boolean;
  // WHY: the two dept fields hold the wizard's picks until completion promotes them to Firestore.
  primaryDeptId: string | null;
  interestDeptIds: string[];
  /** WHY: device-local and one-way: a key is only ever added. */
  seen: Partial<Record<SeenKey, true>>;
  /**
   * WHY: the device's record, so the choice follows it across a uid change; re-applied only on such
   * a transition, never per snapshot, so an unsubscribe on another device sticks. Survives a reset.
   */
  miniAppOptIns: string[];
  /**
   * WHY: accepting offline can stall before the write is issued, and a kill would then lose a choice
   * whose prompt is already marked seen; what is left here is retried.
   */
  pendingMiniAppOptIns: string[];
  /**
   * WHY: chips groups only: a segmented group's choice is a direction, which changes with the time of
   * day. An id the server no longer lists is ignored when read.
   */
  lastServiceByGroup: Record<string, string>;
  /** WHY: only a tap writes a key, so a missing one leaves the server's `initialState` in charge. */
  transitGroupStates: Record<string, TransitGroupState>;
  /**
   * WHY: only a tap writes a key, so a server change to the default line or direction still reaches
   * every station left alone. A code the station no longer serves is ignored when read.
   */
  subwayChoices: Record<string, SubwayChoice>;
}

interface SettingsActions {
  setPreferredCampus: (campus: Campus) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setLastTab: (tab: TabRoute) => void;
  setLastService: (groupId: string, serviceId: string) => void;
  setTransitGroupState: (groupId: string, state: TransitGroupState) => void;
  setSubwayLine: (stationId: string, lineCode: string) => void;
  setSubwayDirection: (stationId: string, lineCode: string, direction: SubwayDirectionKey) => void;
  markSeen: (key: SeenKey) => void;
  setMiniAppOptIn: (miniAppId: string, on: boolean) => void;
  clearMiniAppOptIns: () => void;
  setMiniAppOptInPending: (miniAppId: string, pending: boolean) => void;
  completeOnboarding: (data: {
    campus: Campus;
    // WHY: null means the user said their department is not listed, not that none was picked yet.
    primaryDeptId: string | null;
    interestDeptIds: string[];
  }) => void;
  /**
   * WHY: always overwrites, or a sign-in to account B after A would keep A's dept. `campus` is absent:
   * Firestore preferences do not store it. Kept apart from completeOnboarding for analytics.
   */
  restoreOnboardingFromRemote: (data: {
    // WHY: restored prefs encode a user who skipped the primary dept as `dept[0] === ''`.
    primaryDeptId: string | null;
    interestDeptIds: string[];
  }) => void;
  /** WHY: device-local fields survive: they are the device owner's choices, not the deleted user's. */
  resetUserScopedState: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * WHY: a new field with a default, or a new `SeenKey`, needs no version bump: there is no `merge`, so
 * the default merge fills it in, and `migrate` runs only when `version` changes.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      preferredCampus: 'hssc',
      appLanguage: 'ko',
      lastTab: 'notices',
      onboardingCompleted: false,
      primaryDeptId: null,
      interestDeptIds: [],
      seen: {},
      miniAppOptIns: [],
      pendingMiniAppOptIns: [],
      lastServiceByGroup: {},
      transitGroupStates: {},
      subwayChoices: {},

      setPreferredCampus: (campus) => set({ preferredCampus: campus }),
      setAppLanguage: (language) => set({ appLanguage: language }),
      setLastTab: (tab) => set({ lastTab: tab }),
      setLastService: (groupId, serviceId) =>
        set((s) => ({ lastServiceByGroup: { ...s.lastServiceByGroup, [groupId]: serviceId } })),
      setTransitGroupState: (groupId, state) =>
        set((s) => ({ transitGroupStates: { ...s.transitGroupStates, [groupId]: state } })),
      setSubwayLine: (stationId, lineCode) =>
        set((s) => ({
          subwayChoices: {
            ...s.subwayChoices,
            [stationId]: { ...s.subwayChoices[stationId], line: lineCode },
          },
        })),
      setSubwayDirection: (stationId, lineCode, direction) =>
        set((s) => {
          const station = s.subwayChoices[stationId];
          return {
            subwayChoices: {
              ...s.subwayChoices,
              [stationId]: { ...station, direction: { ...station?.direction, [lineCode]: direction } },
            },
          };
        }),
      markSeen: (key) => set((s) => ({ seen: { ...s.seen, [key]: true } })),
      setMiniAppOptIn: (miniAppId, on) =>
        set((s) => {
          const others = s.miniAppOptIns.filter((id) => id !== miniAppId);
          return { miniAppOptIns: on ? [...others, miniAppId] : others };
        }),
      clearMiniAppOptIns: () => set({ miniAppOptIns: [], pendingMiniAppOptIns: [] }),
      setMiniAppOptInPending: (miniAppId, pending) =>
        set((s) => {
          const others = s.pendingMiniAppOptIns.filter((id) => id !== miniAppId);
          return { pendingMiniAppOptIns: pending ? [...others, miniAppId] : others };
        }),
      completeOnboarding: (data) =>
        set({
          preferredCampus: data.campus,
          primaryDeptId: data.primaryDeptId,
          interestDeptIds: data.interestDeptIds,
          onboardingCompleted: true,
        }),
      restoreOnboardingFromRemote: (data) =>
        set({
          primaryDeptId: data.primaryDeptId,
          interestDeptIds: data.interestDeptIds,
          onboardingCompleted: true,
        }),
      resetUserScopedState: () =>
        set({
          onboardingCompleted: false,
          primaryDeptId: null,
          interestDeptIds: [],
        }),
    }),
    {
      name: 'settings',
      version: 5,
      storage: createJSONStorage(() => mmkvStateStorage),
      migrate: (persisted, version) => {
        const state = { ...(persisted as Record<string, unknown>) };
        if (version === 0) {
          delete state.selectedDeptIds;
          delete state.selectedLibIds;
          delete state.setSelectedDeptIds;
          delete state.setSelectedLibIds;
        }
        if ((version ?? 0) < 2) {
          // WHY: installs that predate onboarding skip it; a new install starts at false.
          state.onboardingCompleted = true;
          state.primaryDeptId = state.primaryDeptId ?? null;
          state.interestDeptIds = state.interestDeptIds ?? [];
        }
        if ((version ?? 0) < 3) {
          if (state.lastTab === 'more') state.lastTab = 'home';
        }
        if ((version ?? 0) < 4) {
          delete state.pickerSelections;
          delete state.setPickerSelection;
        }
        if ((version ?? 0) < 5) {
          // WHY: a v4 payload without `introSeen` predates the intro, so it stays unseen and is toured once.
          state.seen = state.introSeen === true ? { intro: true } : {};
          delete state.introSeen;
          delete state.completeIntro;
        }
        return state as unknown as SettingsStore;
      },
    },
  ),
);
