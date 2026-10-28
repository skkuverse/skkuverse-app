/** WHY: no `__DEV__` or `expo-*` import, or the vitest suites cannot load it. */

import type {
  PlaceAction,
  PlaceBlock,
  PlaceBlockType,
  PlaceDetail,
  PlaceInstagramAction,
} from './place-detail.types';
import type { ActionType, I18nText } from '@skkuverse/shared';
import type { MapOverlay, MarkerAction } from '../overlay.types';

export type PlaceSectionKey = 'facts' | 'blocks';

/** WHY: always starts with `facts`: most places have no detail, and every one still carries `hours` on the overlay. */
export function placeSections(detail: PlaceDetail | null): PlaceSectionKey[] {
  const sections: PlaceSectionKey[] = ['facts'];
  if (detail !== null && detail.blocks.length > 0) sections.push('blocks');
  return sections;
}

const HIGHLIGHT_TYPES: readonly PlaceBlockType[] = ['list', 'table'];

/** WHY: per block type, not per place kind: three list chips fit on a line; a table row is a full-width name and price. */
export const HIGHLIGHT_MAX: Readonly<Record<'list' | 'table', number>> = { list: 3, table: 1 };

/** WHY: the operator chooses the highlight by ordering their blocks, so one rule serves every kind of place. */
export function highlightBlock(blocks: readonly PlaceBlock[]): PlaceBlock | null {
  return blocks.find((block) => HIGHLIGHT_TYPES.includes(block.type)) ?? null;
}

export interface PlaceImage {
  id: string;
  url: string;
  caption: I18nText | null;
}

/** WHY: `id` is the first image's, so it stays stable while the run's head does. */
export type PlaceBodyItem =
  | { type: 'block'; id: string; block: PlaceBlock }
  | { type: 'gallery'; id: string; images: PlaceImage[] };

/** WHY: only adjacent images fold; an image between two paragraphs is a gallery of one and stays put. */
export function placeBody(blocks: readonly PlaceBlock[]): PlaceBodyItem[] {
  const items: PlaceBodyItem[] = [];
  for (const block of blocks) {
    if (block.type !== 'image') {
      items.push({ type: 'block', id: block.id, block });
      continue;
    }
    const image: PlaceImage = { id: block.id, url: block.url, caption: block.caption };
    const last = items[items.length - 1];
    if (last?.type === 'gallery') last.images.push(image);
    else items.push({ type: 'gallery', id: block.id, images: [image] });
  }
  return items;
}

/** WHY: the body skips this gallery by `id`, so a photo is never drawn twice in one sheet. */
export function heroGallery(body: readonly PlaceBodyItem[]): Extract<PlaceBodyItem, { type: 'gallery' }> | null {
  for (const item of body) if (item.type === 'gallery') return item;
  return null;
}

export const NAVIGABLE_ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'route',
  'webview',
  'external',
  'miniapp',
]);

/** WHY: a whole row for one pill pushed the menu and poster down; with any other action the row stays. */
export function soleInstagram(
  actions: readonly MarkerAction[],
  detailActions: readonly PlaceAction[],
): PlaceInstagramAction | null {
  if (actions.some((a) => NAVIGABLE_ACTION_TYPES.has(a.actionType))) return null;
  if (detailActions.some((a) => a.type !== 'instagram')) return null;
  return detailActions.find((a): a is PlaceInstagramAction => a.type === 'instagram') ?? null;
}

export const SOLO_IMAGE_DEFAULT_ASPECT = 4 / 5;

/**
 * WHY: drawn whole rather than cropped into the rail's thumbnail; the wire carries no size, so `aspect`
 * is the loaded image's own.
 */
export function soloImageSize(
  aspect: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : SOLO_IMAGE_DEFAULT_ASPECT;
  const width = Math.min(maxWidth, maxHeight * ratio);
  return { width, height: width / ratio };
}

/**
 * WHY: an area-only pin has nothing to show above the low detent. Only a marker can be `area`; a zone keeps
 * the low detent, which shows the zone itself.
 */
export function placeSheetOpensTall(place: MapOverlay | null): boolean {
  return place?.kind === 'marker' && place.locationAccuracy === 'area';
}
