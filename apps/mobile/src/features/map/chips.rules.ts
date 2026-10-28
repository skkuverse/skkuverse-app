/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.2: a tap sets only the
 * layers sharing the named layers' `chipGroupId` (named on, siblings off, others untouched) and never a
 * `userConfigurable: false` layer.
 */

import type { ActionType } from '@skkuverse/shared';
import { toMapSheetKey, type MapTaskAction } from './map-task.rules';
import type { LayerLens, MapChip, MapChipCamera, MapLayerDef, MapTabId } from './map-config.types';
import { isFestivalLayer, type TabScope } from './layers.rules';
import { REVEAL } from './sheet-detents.constants';
import { MAP_SHEET_PROFILES } from './sheet-stack.constants';
import { DEFAULT_TABS } from './map.constants';


/** WHY: a chip without `tabs` shows in the map tab, as on installed builds. */
export function chipsForTab(chips: readonly MapChip[], tab: MapTabId): MapChip[] {
  return chips.filter((chip) => (chip.tabs ?? DEFAULT_TABS).includes(tab));
}

/** WHY: where `tabs` is ignored, a `layers` chip is dropped, as installed builds drop the kind. */
export function chipsFor(scope: TabScope, tab: MapTabId, chips: MapChip[]): MapChip[] {
  if (scope === 'byTab') return chipsForTab(chips, tab);
  return chips.some(isLayersChip) ? chips.filter((chip) => !isLayersChip(chip)) : chips;
}

/** WHY: looked up in the focused tab's row, so a chip the row leaves out is not reachable from the map either. */
export function chipOfTap(scope: TabScope, tab: MapTabId, chips: MapChip[], chipId: string): MapChip | null {
  return chipsFor(scope, tab, chips).find((chip) => chip.id === chipId) ?? null;
}

function isLayersChip(chip: MapChip): boolean {
  return chip.action.kind === 'layers';
}

/**
 * WHY: a chip whose result is on the map runs in the map tab, wherever it was tapped (ADR 0022 d1). A chip is
 * only ever on in the map tab.
 */
export function chipRunsIn(chip: MapChip): MapTabId {
  return chip.opensIn === 'transit' ? 'transit' : 'map';
}

function chipRunsInFor(scope: TabScope, chip: MapChip): MapTabId {
  return scope === 'all' ? 'map' : chipRunsIn(chip);
}


export type ChipRun =
  | { kind: 'map'; task: MapTaskAction | null; camera: MapChipCamera | null; reveal: boolean }
  | { kind: 'transitFilter'; chipId: string };

/**
 * WHY: a chip tapped on the transit row is pushed over what the map tab has open, so closing returns to it
 * (ADR 0022 d1); a chip that lists event places leaves the sheet to the list.
 */
export function planChipRun(
  chip: MapChip,
  tappedIn: MapTabId,
  scope: TabScope,
  layers: readonly MapLayerDef[],
): ChipRun | null {
  const { action } = chip;
  if (action.kind === 'webview' || action.kind === 'link') return null;
  if (chipRunsInFor(scope, chip) === 'transit') return { kind: 'transitFilter', chipId: chip.id };
  const camera = action.camera;
  if (chip.isReset) return { kind: 'map', task: { type: 'releaseChip' }, camera, reveal: false };
  const next = toChipLayers(chip, layers);
  const reveal = scope === 'byTab' && (next ? !listsEventPlaces(next, layers) : camera !== null);
  if (!next) return { kind: 'map', task: null, camera, reveal };
  return {
    kind: 'map',
    task: {
      type: tappedIn === 'map' ? 'select' : 'push',
      request: { kind: 'chip', chipId: chip.id },
      key: toMapSheetKey({ kind: 'chip', chipId: chip.id }),
      layers: next,
      detent: reveal ? REVEAL : MAP_SHEET_PROFILES.list.opening,
    },
    camera,
    reveal,
  };
}

function listsEventPlaces(write: LayerLens, layers: readonly MapLayerDef[]): boolean {
  return layers.some((l) => write[l.id] === true && isFestivalLayer(l));
}

/** WHY: derived from the action; the server sends no icon. */
export type ChipMark = 'leaves' | 'moves' | null;

function linkMark(actionType: ActionType): ChipMark {
  switch (actionType) {
    case 'webview':
    case 'external':
    case 'miniapp':
      return 'leaves';
    case 'route':
    case 'map':
      return 'moves';
    case 'content':
    case 'unknown':
      return null;
  }
}

export function chipMark(chip: MapChip, tappedIn: MapTabId): ChipMark {
  const { action } = chip;
  switch (action.kind) {
    case 'webview':
      return 'leaves';
    case 'link':
      return linkMark(action.actionType);
    case 'focus':
    case 'layers':
      return chipRunsIn(chip) === tappedIn ? null : 'moves';
  }
}

/**
 * WHY: an id the config does not serve is outside its activation window, and a null group is a layer no chip
 * may change; either way the chip keeps its camera and changes no visibility.
 */
function resolveGroup(
  chip: MapChip,
  layers: readonly MapLayerDef[],
): string | null {
  if (chip.action.kind !== 'focus') return null;
  for (const id of chip.action.layerIds) {
    const group = layers.find((l) => l.id === id)?.chipGroupId;
    if (group) return group;
  }
  return null;
}

/** WHY: rule 2 lives here alone, so no caller can forget it. */
function writableGroupLayers(
  group: string,
  layers: readonly MapLayerDef[],
): MapLayerDef[] {
  return layers.filter(
    (l) => l.chipGroupId === group && l.userConfigurable !== false,
  );
}

/** WHY: a layer outside the group is absent, not false; the write must not mention it. */
export function toChipLayers(
  chip: MapChip,
  layers: readonly MapLayerDef[],
): Record<string, boolean> | null {
  if (chip.action.kind === 'layers') return namedLayersOn(chip.action.layerIds, layers);
  const group = resolveGroup(chip, layers);
  if (group === null || chip.action.kind !== 'focus') return null;
  const named = new Set(chip.action.layerIds);
  const next: Record<string, boolean> = {};
  for (const layer of writableGroupLayers(group, layers)) {
    next[layer.id] = named.has(layer.id);
  }
  return next;
}

/** WHY: rule 2 holds here too. */
function namedLayersOn(layerIds: readonly string[], layers: readonly MapLayerDef[]): Record<string, boolean> | null {
  const named = new Set(layerIds);
  const on = layers.filter((l) => named.has(l.id) && l.userConfigurable !== false);
  return on.length > 0 ? Object.fromEntries(on.map((l) => [l.id, true])) : null;
}
