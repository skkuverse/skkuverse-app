import type { LayerLens, MapLayerDef, MapTabId } from './map-config.types';
import { isDailyWindowOpen, kstMinutesOfDay } from './layer-schedule.rules';
import { DEFAULT_TABS } from './map.constants';

/**
 * WHY: not `endpoint === '/map/overlays/event'`: `endpoint` is a cache key, so merging or splitting a route
 * would silently move this boundary.
 */
export function isFestivalLayer(layer: MapLayerDef): boolean {
  return layer.chipGroupId !== null;
}

/**
 * WHY: every record holds only what someone expressed, so an absent id defers to the next tier, and closing a
 * sheet restores the user's own choices rather than the server's defaults.
 */
export interface LayerVisibilityInputs {
  stackLens: LayerLens;
  userToggles: LayerLens;
  tabDefault: LayerLens;
}

/**
 * WHY: `null`, an unreadable declaration, is off, the opposite of `userConfigurable`: this axis exists to put
 * less on screen (`defaultVisibleWhenSchema`).
 */
export function defaultVisibleAt(layer: MapLayerDef, now: number): boolean {
  const when = layer.defaultVisibleWhen;
  if (when === null) return false;
  switch (when.kind) {
    case 'always':
      return true;
    case 'never':
      return false;
    case 'scheduled': {
      const minutes = kstMinutesOfDay(now);
      return when.windows.some((w) => isDailyWindowOpen(w, minutes));
    }
  }
}

/**
 * WHY: every tier is a fallback, never an assignment: writing one into the store freezes the schedule and
 * makes the user's choice indistinguishable from the server's. One function, since copies at three call
 * sites drifted once.
 */
export function isLayerVisible(
  layer: MapLayerDef,
  inputs: LayerVisibilityInputs,
  now: number,
): boolean {
  if (layer.userConfigurable === false) return defaultVisibleAt(layer, now);
  return (
    inputs.stackLens[layer.id] ??
    inputs.userToggles[layer.id] ??
    inputs.tabDefault[layer.id] ??
    defaultVisibleAt(layer, now)
  );
}

/**
 * WHY: absent `tabs` is `['map']`, so the festival stays out of the transit tab and the shuttle routes
 * out of the map tab.
 */
export function tabDefaultLens(
  tab: MapTabId,
  layers: readonly MapLayerDef[],
): Record<string, boolean> {
  return Object.fromEntries(
    layers.filter((l) => !(l.tabs ?? DEFAULT_TABS).includes(tab)).map((l) => [l.id, false]),
  );
}

/** WHY: ADR 0022 rule 1: an open task's lens fades every layer the task did not name and the user did not turn on. */
export function isLayerDimmed(
  layer: MapLayerDef,
  inputs: LayerVisibilityInputs,
  dimOthers: boolean,
): boolean {
  return dimOthers && inputs.stackLens[layer.id] === undefined && inputs.userToggles[layer.id] !== true;
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.9. Decided by the shell,
 * never a feature; `all` ignores `tabs` entirely, as installed builds do.
 */
export type TabScope = 'all' | 'byTab';

export function tabDefaultFor(scope: TabScope, tab: MapTabId, layers: readonly MapLayerDef[]): Record<string, boolean> {
  return scope === 'all' ? {} : tabDefaultLens(tab, layers);
}
