import type { Campus } from '@skkuverse/shared';
import { MAP_DETENT_RANK, type MapDetent } from '@/features/map/sheet-detents.constants';
import type { TransitSection } from './transit.types';

export function toInfoUrl(features: Record<string, unknown>[]): string | undefined {
  const info = features.find((f) => f.type === 'info');
  return info?.url as string | undefined;
}

// WHY: an untagged section (the inter-campus shuttle) always shows.
export function sectionsForCampus(sections: readonly TransitSection[], campus: Campus): TransitSection[] {
  return sections.filter((s) => s.campus === null || s.campus === campus);
}

// WHY: the old shell has no campus toggle, never calls this and keeps the served titles.
export function withoutSectionTitles(sections: readonly TransitSection[]): TransitSection[] {
  return sections.map((s) => ({ ...s, title: null }));
}

/**
 * WHY: a settle already below the opening is not a pull-down, because a tab switch re-reports the detent the sheet remembers.
 */
export function isRootPullDown(from: MapDetent, to: MapDetent, opening: MapDetent): boolean {
  return MAP_DETENT_RANK[from] >= MAP_DETENT_RANK[opening] && MAP_DETENT_RANK[to] < MAP_DETENT_RANK[opening];
}
