/**
 * The one place a gorhom index meets a level name: the stops a profile
 * resolves to, the conversions both ways, and the per-index tables the UI
 * thread reads.
 */

import { describe, expect, it } from 'vitest';
import { MAP_DETENT_RANK, NAVER_LOGO_HEIGHT, NAVER_LOGO_MARGIN, type MapDetent } from './sheet-detents.constants';
import {
  bodyRevealAt,
  contentBottomOf,
  coveredHeightAt,
  drivesBarAt,
  indexOfLevel,
  levelAtIndex,
  logoBandOf,
  nearestLevel,
  openingLevel,
  stopsOf,
  toLegacyStops,
  toMapSheetStops,
  type DetentMeasure,
  type LegacyRootSheet,
} from './sheet-detents.rules';
import { MAP_SHEET_PROFILES, type MapSheetProfile } from './sheet-stack.constants';

/** The reference phone under the shared map: an 874 pt container, the chips on, an 83 pt tab bar. */
const PRO: DetentMeasure = { containerHeight: 874, controlsBottom: { world: 171, taskField: 122 }, minFrame: 22 + contentBottomOf(83) };
const LABELS: Readonly<Record<MapDetent, string>> = { min: '접힘', mid: '중간', max: '펼침', page: '전체 화면' };
/** The native tabs' campus sheet, kept in today's SDS heights. */
const LEGACY_CAMPUS: LegacyRootSheet = {
  profile: MAP_SHEET_PROFILES.campusRoot,
  position: { kind: 'expandable', detents: ['small', 'medium', 'large'], initial: 'small', heights: { small: '24%', medium: '42%' } },
};
const onTable = (body: MapSheetProfile | null, root: MapSheetProfile = MAP_SHEET_PROFILES.campusRoot) =>
  toMapSheetStops(body, root, PRO, LABELS);

describe('stopsOf: the size table, or today\'s heights under a root a shell keeps there', () => {
  it('puts a body on the size table under a root that is on it', () => {
    const root = { profile: MAP_SHEET_PROFILES.campusRoot, legacyPosition: null };
    expect(stopsOf(MAP_SHEET_PROFILES.list, root, PRO, LABELS).position.kind).toBe('stops');
  });

  it('keeps the list over the native campus sheet in its SDS heights', () => {
    const root = { profile: MAP_SHEET_PROFILES.campusRoot, legacyPosition: LEGACY_CAMPUS.position };
    expect(stopsOf(MAP_SHEET_PROFILES.list, root, PRO, LABELS).position).toEqual({ ...LEGACY_CAMPUS.position, initial: 'small' });
  });
});

describe('the stops: the level each index stands for, and the tables the UI thread reads', () => {
  it("names a body's indices by its profile, and the root's by the root's", () => {
    expect(onTable(MAP_SHEET_PROFILES.route).levels).toEqual(['min', 'mid', 'page']);
    expect(onTable(null, MAP_SHEET_PROFILES.transitRoot).levels).toEqual(['min', 'mid', 'max']);
    expect(toLegacyStops(MAP_SHEET_PROFILES.list, LEGACY_CAMPUS).levels).toEqual(['min', 'mid', 'max']);
  });

  it('marks the page, and drives the tab bar from it on a pushed body, from the top level on a root', () => {
    const route = onTable(MAP_SHEET_PROFILES.route);
    expect(route.pageIndex).toBe(2);
    expect(route.barIndex).toBe(2);
    const place = onTable(MAP_SHEET_PROFILES.place);
    expect(place.pageIndex).toBe(-1);
    expect(place.barIndex, 'a pushed body without a page never drives the bar').toBe(-1);
    expect(onTable(null).barIndex).toBe(2);
    expect(toLegacyStops(null, LEGACY_CAMPUS).barIndex).toBe(2);
  });

  it("tables how much of the body each index shows: a line's header alone at min", () => {
    expect(onTable(MAP_SHEET_PROFILES.route).bodyReveal).toEqual([0, 1, 1]);
    expect(onTable(MAP_SHEET_PROFILES.stop).bodyReveal).toEqual([1, 1, 1]);
  });
});

describe('levelAtIndex and indexOfLevel: the conversion both ways', () => {
  const route = onTable(MAP_SHEET_PROFILES.route);
  const transit = onTable(null, MAP_SHEET_PROFILES.transitRoot);

  it('round-trips every level a sheet has', () => {
    for (const stops of [route, transit]) {
      for (const level of stops.levels) expect(levelAtIndex(stops, indexOfLevel(stops, level))).toBe(level);
    }
  });

  it('reads a closed sheet, or an index the stops lack, as no level', () => {
    expect(levelAtIndex(route, -1)).toBeNull();
    expect(levelAtIndex(transit, 3)).toBeNull();
  });

  it('lands a level the sheet lacks on the nearest one below it, else the lowest', () => {
    expect(indexOfLevel(route, 'max'), 'a line has no max').toBe(1);
    expect(indexOfLevel(transit, 'page')).toBe(2);
  });

  it('reads each report against the stops it is given, so a snap that reported nothing holds no later report back', () => {
    // gorhom never reports a snap to where the sheet already is (BottomSheet.tsx:557,
    // 1139-1145): a stop opened at mid over a line at mid reports nothing, and the
    // user's drag to max is the next report. It is read as max, with nothing pending.
    const stop = onTable(MAP_SHEET_PROFILES.stop);
    expect(levelAtIndex(stop, indexOfLevel(stop, 'mid'))).toBe('mid');
    expect(levelAtIndex(stop, 2)).toBe('max');
  });
});

describe('nearestLevel: a live, fractional index as a level', () => {
  const route = onTable(MAP_SHEET_PROFILES.route);

  it('rounds to the nearest level, and clamps an over-drag to the top', () => {
    expect(nearestLevel(route, 0.4)).toBe('min');
    expect(nearestLevel(route, 1.6)).toBe('page');
    expect(nearestLevel(route, 2.3)).toBe('page');
  });

  it('is null for a sheet that reads as closed', () => {
    expect(nearestLevel(route, -1)).toBeNull();
    expect(nearestLevel(route, -0.7)).toBeNull();
  });
});

describe('openingLevel: where a view opens the inline sheet', () => {
  const route = onTable(MAP_SHEET_PROFILES.route);
  const transit = onTable(null, MAP_SHEET_PROFILES.transitRoot);

  it('is the level the view asks for', () => {
    expect(openingLevel('mid', route, false)).toBe('mid');
  });

  it('is the top level under a screen reader, so the whole sheet is in reach without a drag', () => {
    expect(openingLevel('mid', route, true)).toBe('page');
    expect(openingLevel('min', transit, true)).toBe('max');
  });
});

describe('bodyRevealAt: how much of the body shows at a live index', () => {
  const route = [0, 1, 1];

  it('is 0 at a headerOnly level, 1 at a full one, and linear between the two over that segment', () => {
    expect(bodyRevealAt(0, route)).toBe(0);
    expect(bodyRevealAt(0.25, route)).toBe(0.25);
    expect(bodyRevealAt(1, route)).toBe(1);
    expect(bodyRevealAt(1.5, route)).toBe(1);
    expect(bodyRevealAt(2, route)).toBe(1);
  });

  it('clamps an over-drag and a closed sheet to the nearest level’s body', () => {
    expect(bodyRevealAt(-1, route)).toBe(0);
    expect(bodyRevealAt(2.4, route)).toBe(1);
  });

  it('is the whole body where no level hides it', () => {
    expect(bodyRevealAt(0.5, [1, 1])).toBe(1);
  });
});

describe("drivesBarAt: whether the sheet's list shrinks the tab bar on scroll", () => {
  it('drives from the bar index up, a hair under it included, where an interpolated index rests', () => {
    expect(drivesBarAt(2, 2)).toBe(true);
    expect(drivesBarAt(1.999, 2)).toBe(true);
    expect(drivesBarAt(1, 1)).toBe(true);
  });

  it('stops as soon as the sheet leaves it, mid-drag included', () => {
    expect(drivesBarAt(1.9, 2)).toBe(false);
    expect(drivesBarAt(0, 1)).toBe(false);
    expect(drivesBarAt(-1, 2)).toBe(false);
  });

  it('never drives without a bar index', () => {
    expect(drivesBarAt(2, -1)).toBe(false);
  });
});

describe('MAP_DETENT_RANK', () => {
  it('orders the four levels low to high', () => {
    const levels: MapDetent[] = ['page', 'min', 'max', 'mid'];
    expect([...levels].sort((a, b) => MAP_DETENT_RANK[a] - MAP_DETENT_RANK[b])).toEqual(['min', 'mid', 'max', 'page']);
  });
});


describe('logoBandOf: the NAVER logo under the top controls, and the max that rests under it', () => {
  it('hangs the logo where the visible map starts and rests max a margin under it (iPhone 17 Pro, the chips on)', () => {
    expect(logoBandOf(171)).toEqual({ paddingTop: 162, logoBottom: 185, maxTop: 194 });
  });

  it("cancels the SDK's floored margin, so the logo starts at the controls' bottom edge", () => {
    const band = logoBandOf(122);
    expect(band.paddingTop + NAVER_LOGO_MARGIN).toBe(122);
    expect(band.logoBottom).toBe(122 + NAVER_LOGO_HEIGHT);
  });

  it('leaves a margin between the logo and a sheet at max', () => {
    const band = logoBandOf(171);
    expect(band.maxTop - band.logoBottom).toBe(NAVER_LOGO_MARGIN);
  });
});

describe('coveredHeightAt: the size table', () => {
  it('is a fixed body over the clearance at min, 55% at mid, the room under the controls and the logo at max and the container at page', () => {
    expect(coveredHeightAt('min', 'world', PRO)).toBe(209);
    expect(coveredHeightAt('mid', 'world', PRO)).toBeCloseTo(480.7);
    expect(coveredHeightAt('max', 'world', PRO)).toBe(680);
    expect(coveredHeightAt('max', 'taskField', PRO)).toBe(729);
    expect(coveredHeightAt('page', 'taskField', PRO)).toBe(874);
  });

  it('never reaches the NAVER logo at a level short of the page, under either chrome', () => {
    for (const chrome of ['world', 'taskField'] as const) {
      const { logoBottom } = logoBandOf(PRO.controlsBottom[chrome]);
      for (const level of ['min', 'mid', 'max'] as const) {
        const top = PRO.containerHeight - (coveredHeightAt(level, chrome, PRO) as number);
        expect(top, `${chrome} ${level}`).toBeGreaterThan(logoBottom);
      }
    }
  });

  it("holds min at 24% of the container until the tab bar's overlap is known, its value on the reference phone", () => {
    expect(coveredHeightAt('min', 'world', { ...PRO, minFrame: null })).toBeCloseTo(209.76);
  });

  it('stands in with percentages before the container is measured', () => {
    const unmeasured = { ...PRO, containerHeight: 0 };
    expect(['min', 'mid', 'max'].map((level) => coveredHeightAt(level as MapDetent, 'world', unmeasured))).toEqual(['24%', '55%', '80%']);
  });

  it('clears the tab bar by 16, never by less than 32', () => {
    expect(contentBottomOf(83)).toBe(99);
    expect(contentBottomOf(0)).toBe(32);
  });
});

describe('toMapSheetStops: a profile on the size table', () => {
  it('stops a line at min, mid and its page, named for a screen reader', () => {
    const stops = toMapSheetStops(MAP_SHEET_PROFILES.route, MAP_SHEET_PROFILES.campusRoot, PRO, LABELS);
    expect(stops.levels).toEqual(['min', 'mid', 'page']);
    expect(stops.position).toEqual({
      kind: 'stops',
      stops: [
        { kind: 'covered', height: 209, label: '접힘', fill: 0 },
        { kind: 'covered', height: (874 * 55) / 100, label: '중간', fill: 0 },
        { kind: 'page', label: '전체 화면', fill: 1 },
      ],
      initialIndex: 0,
    });
    expect(stops.pageIndex).toBe(2);
    expect(stops.barIndex).toBe(2);
    expect(stops.bodyReveal).toEqual([0, 1, 1]);
    expect(stops.fill, 'glass at min and mid, solid at the page').toEqual([0, 0, 1]);
  });

  it('tables every sheet glass at min and mid and solid at max, a root as a pushed sheet', () => {
    for (const profile of [MAP_SHEET_PROFILES.place, MAP_SHEET_PROFILES.stop, MAP_SHEET_PROFILES.list, MAP_SHEET_PROFILES.peek]) {
      expect(onTable(profile).fill).toEqual([0, 0, 1]);
    }
    expect(onTable(null, MAP_SHEET_PROFILES.transitRoot).fill).toEqual([0, 0, 1]);
  });

  it('rests a building under the world chrome and a stop under the task field', () => {
    const place = toMapSheetStops(MAP_SHEET_PROFILES.place, MAP_SHEET_PROFILES.campusRoot, PRO, LABELS);
    const stop = toMapSheetStops(MAP_SHEET_PROFILES.stop, MAP_SHEET_PROFILES.campusRoot, PRO, LABELS);
    const top = (s: typeof place) => (s.position.kind === 'stops' ? s.position.stops.at(-1) : undefined);
    expect(top(place)).toMatchObject({ kind: 'covered', height: 680 });
    expect(top(stop)).toMatchObject({ kind: 'covered', height: 729 });
    expect(place.barIndex, 'a pushed body without a page never drives the bar').toBe(-1);
  });

  it("gives every body the root's opening index, so gorhom never snaps on a push or a pop", () => {
    for (const root of [MAP_SHEET_PROFILES.campusRoot, MAP_SHEET_PROFILES.thisWeekRoot, MAP_SHEET_PROFILES.transitRoot]) {
      const indices = Object.values(MAP_SHEET_PROFILES).map((profile) => {
        const { position } = toMapSheetStops(profile, root, PRO, LABELS);
        return position.kind === 'stops' ? position.initialIndex : -1;
      });
      expect(new Set(indices).size).toBe(1);
      expect(indices[0]).toBe(root.levels.indexOf(root.opening));
      for (const profile of Object.values(MAP_SHEET_PROFILES)) expect(indices[0]!).toBeLessThan(profile.levels.length);
    }
  });

  it('leaves out a level that would not rise above the one below it, and keeps two stops at least', () => {
    const squeezed: DetentMeasure = { containerHeight: 300, controlsBottom: { world: 171, taskField: 122 }, minFrame: 22 + 32 };
    const stops = toMapSheetStops(MAP_SHEET_PROFILES.place, MAP_SHEET_PROFILES.campusRoot, squeezed, LABELS);
    expect(stops.levels).toEqual(['min', 'mid']);
    const tiny: DetentMeasure = { containerHeight: 120, controlsBottom: { world: 171, taskField: 122 }, minFrame: 22 + 32 };
    expect(toMapSheetStops(MAP_SHEET_PROFILES.place, MAP_SHEET_PROFILES.campusRoot, tiny, LABELS).levels).toHaveLength(2);
  });
});
