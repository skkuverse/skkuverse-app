/**
 * Every inline sheet position the map produced on 2026-10-24, frozen before
 * the detent scale replaced the code that computed them, for the stack still
 * kept in those heights: the native tabs' campus sheet and the chip list
 * over it, with the padding each detent leaves and the locate row's park.
 * The fixture is generated output, never hand-edited; a row leaves it only
 * with the code path it froze.
 *
 * Read through the level names: each profile's levels stand for SDS's
 * detents in order, and the stops, the padding and the park must be exactly
 * what the SDS-named code gave.
 */

import { describe, expect, it } from 'vitest';
import type { SheetDetent, SheetPosition } from '@skkuverse/sds';
import golden from './__fixtures__/sheet-positions.golden.json';
import type { MapDetent } from './sheet-detents.constants';
import { coveredAt, parkTopOf, toLegacyStops, type LegacyRootSheet } from './sheet-detents.rules';
import { MAP_SHEET_PROFILES } from './sheet-stack.constants';
import { floatingInset } from './sheet-stack.rules';

const SDS = { small: 45, medium: 65 };
const CAMPUS: LegacyRootSheet = {
  profile: MAP_SHEET_PROFILES.campusRoot,
  position: { kind: 'expandable', detents: ['small', 'medium', 'large'], initial: 'small', heights: { small: '24%', medium: '42%' } },
};
const MEASURES = golden.measures as Record<string, { containerHeight: number; floatInset: number }>;

/** What each SDS detent is called by name on the campus sheet and the list over it. */
const NAMES: Record<SheetDetent, MapDetent> = { small: 'min', medium: 'mid', large: 'max' };

describe('the frozen campus sheet positions, read by level name', () => {
  for (const c of golden.cases) {
    it(`${c.body ?? 'root'} over ${c.root}, ${c.measure}`, () => {
      const m = MEASURES[c.measure]!;
      const stops = toLegacyStops(c.body ? MAP_SHEET_PROFILES.list : null, CAMPUS);
      const position = c.position as SheetPosition;
      const detents = position.kind === 'expandable' ? position.detents : [];

      expect(stops.position).toEqual(position);
      expect(stops.levels).toEqual(detents.map((d) => NAMES[d]));
      expect(floatingInset(stops.position, m.floatInset)).toBe(c.floatingInset);
      for (const d of detents) {
        expect(coveredAt(stops, NAMES[d], m.containerHeight, SDS, m.floatInset)).toBe((c.restingInset as Record<string, number>)[d]);
      }
      expect(parkTopOf(toLegacyStops(null, CAMPUS), 'mid', m.containerHeight, SDS, m.floatInset)).toBe(c.locateAnchorTop);
    });
  }
});
