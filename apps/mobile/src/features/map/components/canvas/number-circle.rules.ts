/**
 * QUIRK(naver-map): the tint adds to every pixel and would turn a red badge orange, so a badged circle is a
 * baked untinted image on a square canvas centred on the circle, keeping the caption on it.
 */

import { BADGE_COUNT_MAX, BADGED_CIRCLE } from './marker.constants';

export type BadgeKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '9p';

export interface NumberCircleLook {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  badge: BadgeKey | null;
}

export function toBadgeKey(count: number): BadgeKey {
  return count > BADGE_COUNT_MAX ? '9p' : (String(count) as BadgeKey);
}

export function numberCircleLook(size: number, count: number | undefined): NumberCircleLook {
  if (count === undefined || count < 1) {
    return { width: size, height: size, anchor: { x: 0.5, y: 1.0 }, badge: null };
  }
  const scale = BADGED_CIRCLE.canvas / BADGED_CIRCLE.circle;
  const canvas = size * scale;
  // WHY: the circle's bottom edge stays on the coordinate, as the plain circle's does.
  const bottom = (BADGED_CIRCLE.canvas + BADGED_CIRCLE.circle) / 2 / BADGED_CIRCLE.canvas;
  return { width: canvas, height: canvas, anchor: { x: 0.5, y: bottom }, badge: toBadgeKey(count) };
}

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/** WHY: none where the gate is closed, so a store build's circles cannot change. */
export function buildingCountsFor(open: boolean, counts: ReadonlyMap<string, number>): ReadonlyMap<string, number> {
  return open && counts.size > 0 ? counts : NO_COUNTS;
}
