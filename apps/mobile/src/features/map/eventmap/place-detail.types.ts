/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/map/event-details/map-event-details.wire.ts mirrors this
 * shape; skkuverse-server/docs/reference/map-overlays-api.md §5.4 is the contract. WHY: the body is typed
 * blocks the operator composes, so a new kind of place is an authoring change, not a release.
 */

import type { I18nText } from '@skkuverse/shared';

/**
 * WHY: closed, unlike a block's `type`: the parser drops a detail whose kind is not here, so a new kind ships
 * here first and on the server second. Nothing branches its rendering on it.
 */
export const PLACE_KINDS = [
  'pub',
  'booth',
  'promo',
  'foodTruck',
  'goods',
  'facility',
  'stage',
  'etc',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export interface PlaceListItem {
  emoji: string | null;
  title: I18nText;
  description: I18nText | null;
}

/** WHY: a formatted string, since a table carries prices, times and plain words alike. */
export interface PlaceTableRow {
  label: I18nText;
  value: I18nText;
}

/**
 * WHY: an open enum: an unknown block type drops alone, never a `never` assertion that would blank a body on an
 * older build. Style belongs to the type, never to the block.
 */
export type PlaceBlock =
  | { type: 'text'; id: string; title: I18nText | null; body: I18nText }
  | { type: 'list'; id: string; title: I18nText | null; items: PlaceListItem[] }
  | { type: 'table'; id: string; title: I18nText | null; rows: PlaceTableRow[] }
  | { type: 'image'; id: string; title: I18nText | null; url: string; caption: I18nText | null }
  | { type: 'notice'; id: string; title: I18nText | null; items: I18nText[] };

export type PlaceBlockType = PlaceBlock['type'];

export interface PlaceInstagramAction {
  type: 'instagram';
  id: string;
  label: I18nText;
  profileUrl: string;
  postUrl: string | null;
}

export interface PlaceLinkAction {
  type: 'link';
  id: string;
  label: I18nText;
  url: string;
}

export type PlaceAction = PlaceLinkAction | PlaceInstagramAction;

export interface PlaceDetail {
  placeId: string;
  kind: PlaceKind;
  org: I18nText | null;
  isUnion: boolean;
  locationLabel: I18nText | null;
  actions: PlaceAction[];
  blocks: PlaceBlock[];
}
