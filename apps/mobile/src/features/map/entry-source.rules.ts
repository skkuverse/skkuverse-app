import type { BuildingDetailSource } from '@/platform/analytics.types';
import type { EntrySource } from '@/platform/analytics.rules';
import type { MapOverlay } from './overlay.types';
import type { PlaceSource } from './sheet-stack.types';

const PLACE_REQUEST_SOURCES: readonly EntrySource[] = ['deeplink', 'miniapp', 'webview', 'sdui', 'place_sheet'];

export function placeRequestSource(source: EntrySource | undefined): PlaceSource {
  if (source === undefined) return 'deeplink';
  return PLACE_REQUEST_SOURCES.includes(source) ? (source as PlaceSource) : 'other';
}

/** WHY: `building_view`'s four source words predate `EntrySource`, and its reports keep them. */
export function buildingDetailSourceOf(source: EntrySource): BuildingDetailSource {
  switch (source) {
    case 'pin':
      return 'marker';
    case 'search':
      return 'search';
    case 'building_sheet':
      return 'connection';
    default:
      return 'direct';
  }
}

export function placeTapSource(kind: MapOverlay['kind']): PlaceSource {
  switch (kind) {
    case 'marker':
      return 'pin';
    case 'path':
      return 'path';
    case 'polygon':
      return 'zone';
  }
}
