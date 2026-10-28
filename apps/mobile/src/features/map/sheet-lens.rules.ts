import type { MapLayerDef, MapTabId } from './map-config.types';
import type { MapOverlay } from './overlay.types';
import type { MapOverlayLens, TaskHeader, TaskOverlay } from './sheet-stack.types';
import { MAP_LENS_ROLES, type MapLensName } from './sheet-stack.constants';

export interface PublishedLens {
  tab: MapTabId;
  entryId: number;
  lens: MapOverlayLens;
}

export interface ResolvedOverlayLens {
  overlays: readonly TaskOverlay[];
  dimOthers: boolean;
  hiddenIds: ReadonlySet<string>;
  header: TaskHeader | null;
}

const NO_OVERLAYS: readonly TaskOverlay[] = [];
const NO_IDS: ReadonlySet<string> = new Set();
const NOTHING_OPEN: ResolvedOverlayLens = {
  overlays: NO_OVERLAYS,
  dimOthers: false,
  hiddenIds: NO_IDS,
  header: null,
};

/**
 * WHY: an entry under the top keeps its lens unmounted, so a line's pins stay under a stop (ADR 0022 d3). The
 * header is the lowest publisher's: a stop over a line is still the line's task.
 */
export function overlayLensOf(
  published: Iterable<PublishedLens>,
  tab: MapTabId,
  stackIds: readonly number[],
): ResolvedOverlayLens {
  const depth = new Map(stackIds.map((id, i) => [id, i]));
  const open = [...published]
    .filter((p) => p.tab === tab && depth.has(p.entryId))
    .sort((a, b) => (depth.get(a.entryId) ?? 0) - (depth.get(b.entryId) ?? 0));
  if (open.length === 0) return NOTHING_OPEN;

  const byId = new Map<string, TaskOverlay>();
  let dimOthers = false;
  let hiddenIds = NO_IDS;
  let header: TaskHeader | null = null;
  for (const { lens } of open) {
    dimOthers ||= lens.dimOthers === true;
    header ??= lens.header ?? null;
    if (lens.hiddenIds?.size) hiddenIds = hiddenIds === NO_IDS ? lens.hiddenIds : new Set([...hiddenIds, ...lens.hiddenIds]);
    const own = new Set<string>();
    for (const overlay of lens.overlays ?? []) {
      // WHY: a loop lists its terminal twice.
      if (own.has(overlay.id)) continue;
      own.add(overlay.id);
      const lower = byId.get(overlay.id);
      byId.set(overlay.id, lower && overlay.subtitle === null ? { ...overlay, subtitle: lower.subtitle } : overlay);
    }
  }
  return { overlays: byId.size > 0 ? [...byId.values()] : NO_OVERLAYS, dimOthers, hiddenIds, header };
}

/** WHY: the same object when nothing drops, so a settle re-renders no marker. */
export function applyMapLens(resolved: ResolvedOverlayLens, lens: MapLensName): ResolvedOverlayLens {
  const shown = MAP_LENS_ROLES[lens];
  const overlays = resolved.overlays.filter((overlay) => shown.has(overlay.role));
  if (overlays.length === resolved.overlays.length) return resolved;
  return { ...resolved, overlays: overlays.length > 0 ? overlays : NO_OVERLAYS };
}

/**
 * QUIRK(naver-map): the SDK resets a marker's alpha to 1 whenever its image loads, so a dimmed layer thins to its
 * recoloured labels rather than fading icons.
 */
export function drawsWhenDimmed(overlay: MapOverlay, layer: Pick<MapLayerDef, 'markerStyle'>): boolean {
  return overlay.kind === 'marker' && layer.markerStyle === 'textLabel';
}
