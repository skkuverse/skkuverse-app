import { router } from 'expo-router';
import { useSettingsStore, type MapPlaceRef, type TabRoute } from '@skkuverse/shared';
import { handleSduiAction, openWebView } from '@/features/web/web.service';
import { logCampusContentSelect, markTabSwitch, track } from '@/platform/analytics';
import type { ChipSource } from '@/platform/analytics.types';
import type { EntrySource } from '@/platform/analytics.rules';
import { devLog } from '@/platform/dev-log';
import { planChipRun, type ChipRun } from './chips.rules';
import { activeChip, decideBack, sheetTabFor, topEntry } from './map-task.rules';
import { mapTabOf, tabRouteOf } from './map-tabs.rules';
import { SHEET_KIND_HOME_TAB } from './map-tabs.constants';
import { mapPlaceLinkQueue, useMapStore } from './map.store';
import type { LayerLens, MapChip, MapLayerDef, MapTabId } from './map-config.types';
import type { MapSheetKind, MapSheetRequest, PageOrigin } from './sheet-stack.types';
import { decideClose, forgetsOrigins, toPageOrigin, type CloseTrigger } from './sheet-close.rules';
import type { MapSheetViewTable } from './sheet-views.types';
import { initialDetentOf } from './sheet-stack.rules';
import type { MapCommands } from './map-host.types';
import type { TabScope } from './layers.rules';

export { mapPlaceLinkQueue as pendingMapPlaceLink, mapChipLinkQueue as pendingMapChipLink } from './map.store';

/**
 * WHY: `dismissTo`, not `push`: the caller is usually a web shell above the tabs, which the map replaces. The
 * reference is set before navigating, so a mounted ViewModel can cancel the round-trip restore before the
 * return focus raises it.
 */
export function openMapAtPlace(ref: MapPlaceRef, source?: EntrySource, origin?: PageOrigin): void {
  if (origin) {
    openPlaceFromAbove(ref, source, origin);
    return;
  }
  // WHY: a place from a page names no tab, so it opens in its home tab (ADR 0022 d7).
  const tab = SHEET_KIND_HOME_TAB[ref.kind ?? 'event'];
  mapPlaceLinkQueue.set({ ...ref, source, tab });
  markTabSwitch(tabRouteOf(tab), 'sheet');
  router.dismissTo(`/(tabs)/${tabRouteOf(tab)}` as never);
}

/** WHY: a screen on the root stack does not move the last focused tab, which is the tab beneath (ADR 0022 d1). */
export function openPlaceFromAbove(ref: MapPlaceRef, source?: EntrySource, origin?: PageOrigin): void {
  const tab = tabBeneath(ref.kind ?? 'event');
  mapPlaceLinkQueue.set({ ...ref, source, tab, ...(origin && { origin: toPageOrigin(origin) }) });
  const route = tabRouteOf(tab);
  if (route !== useSettingsStore.getState().lastTab) markTabSwitch(route, 'sheet');
  router.dismissTo(`/(tabs)/${route}` as never);
}

export function tabBeneath(kind: MapSheetKind): MapTabId {
  return sheetTabFor(kind, mapTabOf(useSettingsStore.getState().lastTab));
}

/** WHY: each press is logged with its tab, since ADR 0022 d1 revisits the button's place by tap rate. */
export function openSearch(from: MapTabId): void {
  logCampusContentSelect({ content_type: 'search_button', item_id: from });
  router.push('/search');
}

export interface ChipRunHost {
  scope: TabScope;
  layers: readonly MapLayerDef[];
  moveTo: MapCommands['moveTo'];
  lowerToReveal: MapCommands['lowerToReveal'];
}

function ranIn(run: ChipRun): MapTabId {
  return run.kind === 'map' ? 'map' : 'transit';
}

/**
 * WHY: a chip on the map runs in the map tab, switching there from the transit row (ADR 0022 d1); the transit
 * tab keeps its task.
 */
export function runChip(chip: MapChip, tappedIn: MapTabId, source: ChipSource, host: ChipRunHost): void {
  const run = planChipRun(chip, tappedIn, host.scope, host.layers);
  // WHY: where `tabs` is ignored there is one map tab, and the event keeps its native-shell shape.
  const tabs = host.scope === 'byTab' ? { tab: tappedIn, ...(run && { ran_in: ranIn(run) }) } : {};
  track('map_chip', { chip_id: chip.id, source, op: 'select', ...tabs });

  const { action } = chip;
  if (action.kind === 'webview') {
    // WHY: the server ships no title beside the URL; a page a chip opened is titled by that chip.
    openWebView({ url: action.url, title: chip.label, source: 'chip' });
    return;
  }
  if (action.kind === 'link') {
    // WHY: a permanent link narrows nothing and moves no camera, so it never becomes the active chip.
    handleSduiAction({
      actionType: action.actionType,
      actionValue: action.actionValue,
      webviewTitle: chip.label,
      source: 'chip',
    });
    return;
  }

  if (!run) return;
  if (run.kind === 'transitFilter') {
    devLog('map.chipTransitFilter', { chipId: run.chipId });
    return;
  }
  // WHY: the entry is written before the tab switches, so the tab opens on the
  // chip rather than restoring the camera of whatever was on top of it.
  if (run.task) useMapStore.getState().dispatchTask('map', run.task);
  if (tappedIn !== 'map') {
    markTabSwitch(tabRouteOf('map'), 'chip');
    router.navigate(`/(tabs)/${tabRouteOf('map')}` as never);
  }
  // WHY: a chip with an entry opens at the level the entry records; one that only moves the camera lowers here.
  if (run.reveal && !run.task) host.lowerToReveal('map');
  // WHY: an explicit request, so the settle switches the campus toggle silently instead of asking.
  if (run.camera) host.moveTo(run.camera, { request: 'chip' });
}

/** WHY: drops the chip's entry and writes nothing, so what comes back is what the user had; no camera move. */
export function clearChip(scope: TabScope): void {
  const chip = activeChip(useMapStore.getState().tasks.map);
  if (chip) {
    track('map_chip', { chip_id: chip.request.chipId, source: 'row', op: 'clear', ...(scope === 'byTab' && { tab: 'map' as const }) });
  }
  closeSheet('map', { kind: 'releaseChip' });
}

export type SheetOpening = 'push' | 'select' | 'open';

export function openSheet(
  tab: MapTabId,
  how: SheetOpening,
  request: MapSheetRequest,
  layers: LayerLens,
  views: Partial<MapSheetViewTable>,
  origin?: PageOrigin,
): void {
  const def = views[request.kind];
  if (!def) {
    devLog('map.sheetWithoutView', { kind: request.kind });
    return;
  }
  // WHY: `def` is the entry for `request.kind`, which indexing the table does not narrow.
  const identity: { keyOf(request: MapSheetRequest): string } = def;
  const key = identity.keyOf(request);
  const detent = initialDetentOf(def, request);
  useMapStore.getState().dispatchTask(tab, { type: how, request, key, layers, detent, ...(origin && { origin }) });
}

/** WHY: the page push follows the dispatch, so the page lands over the stack as it is left. */
export function closeSheet(tab: MapTabId, trigger: CloseTrigger): void {
  const { tasks, dispatchTask } = useMapStore.getState();
  const { action, returnTo } = decideClose(tasks[tab], trigger);
  if (action) dispatchTask(tab, action);
  if (returnTo) router.push({ pathname: returnTo.href, params: returnTo.params } as never);
}

export function backOnMapTab(
  tab: MapTabId,
  views: Partial<MapSheetViewTable>,
  screenReader: boolean,
): 'handled' | 'home' {
  const { tasks, dispatchTask } = useMapStore.getState();
  const back = decideBack(tasks[tab], (request) => initialDetentOf(views[request.kind], request), screenReader);
  switch (back.kind) {
    case 'collapse':
      dispatchTask(tab, { type: 'setDetent', detent: back.to });
      return 'handled';
    case 'pop':
      closeSheet(tab, { kind: 'back' });
      return 'handled';
    case 'home':
      return 'home';
  }
}

export function followFocusedRoute(previous: TabRoute | null, next: TabRoute | null): void {
  if (!forgetsOrigins(previous, next)) return;
  const { dispatchTask } = useMapStore.getState();
  dispatchTask('map', { type: 'dropOrigins' });
  dispatchTask('transit', { type: 'dropOrigins' });
}

export function popMapTaskToRoot(tab: MapTabId): boolean {
  if (!topEntry(useMapStore.getState().tasks[tab])) return false;
  closeSheet(tab, { kind: 'retap' });
  return true;
}
