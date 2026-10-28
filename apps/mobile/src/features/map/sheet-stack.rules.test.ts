/**
 * The sheet stack on screen: bodies under cards, one card per kind, the
 * profile each body brings to the inline sheet, and a detent's index on it.
 */

import { describe, it, expect } from 'vitest';
import type { SheetPosition } from '@skkuverse/sds';
import { EMPTY_TASK, reduceMapTask, type MapTaskAction } from './map-task.rules';
import type { MapSheetRequest, MapTaskState } from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';
import type { MapDetent } from './sheet-detents.constants';
import {
  MAP_SHEET_PROFILES,
  ROOT_PRESENTATION,
} from './sheet-stack.constants';
import {
  bodyLabelOf,
  decideSheetMove,
  floatingInset,
  framingDetentOf,
  initialDetentOf,
  coversTabBarOf,
  locateAnchorTopOf,
  positionOf,
  presentationAt,
  profileOf,
  restingInsetOf,
  tabSwitchSnap,
  toSheetStackLayout,
  topProfile,
} from './sheet-stack.rules';

const BUILDING: MapSheetRequest = { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'pin' };
const BOOTH: MapSheetRequest = { kind: 'event', placeId: 'eskara26-booth-3', source: 'pin' };
const CHIP: MapSheetRequest = { kind: 'chip', chipId: 'eskara26_view_bar' };
const LINE: MapSheetRequest = { kind: 'line', groupId: 'hssc', source: 'tab' };

const Nothing = () => null;
/** An opaque key per distinct request, as each kind's owner would name one. */
const keyOf = (request: MapSheetRequest) => JSON.stringify(request);

/** The old shell's composition: places float as cards, the chip's list swaps the body. */
const CARDS: Partial<MapSheetViewTable> = {
  skku_building: { presentation: 'over', View: Nothing, keyOf },
  event: { presentation: 'over', View: Nothing, keyOf },
  chip: { presentation: 'swap', View: Nothing, profile: 'list', label: 'map.sheet.a11y.list', keyOf },
};

/** The new shell's composition: every place swaps the body. */
const BODIES: Partial<MapSheetViewTable> = {
  skku_building: { presentation: 'swap', View: Nothing, profile: 'place', label: 'map.sheet.a11y.building', keyOf },
  event: { presentation: 'swap', View: Nothing, profile: 'peek', label: 'map.sheet.a11y.place', keyOf },
  chip: { presentation: 'swap', View: Nothing, profile: 'list', label: 'map.sheet.a11y.list', keyOf },
  line: { presentation: 'swap', View: Nothing, profile: 'route', label: 'transit.sheet.a11y.line', keyOf },
};

const SDS = { small: 45, medium: 65 };
/**
 * The transit root as a two-detent card kept in SDS heights: its medium under
 * controls ending at 150 in an 800 pt host, and the same under Liquid Glass,
 * where the card floats 8 pt off the bottom of a container 8 pt shorter.
 */
const PANEL: SheetPosition = { kind: 'expandable', detents: ['small', 'medium'], initial: 'medium', heights: { medium: 650 } };
const PANEL_FLOATING: SheetPosition = { ...PANEL, heights: { medium: 642 } };

const push = (request: MapSheetRequest): MapTaskAction => ({ type: 'push', request, key: keyOf(request), layers: {}, detent: 'mid' });
const run = (...actions: MapTaskAction[]): MapTaskState => actions.reduce(reduceMapTask, EMPTY_TASK);
const kinds = (entries: readonly { request: MapSheetRequest }[]) => entries.map((e) => e.request.kind);

describe('toSheetStackLayout', () => {
  it('puts swap entries in the body chain, lowest first, and over entries in the cards', () => {
    const task = run(push(CHIP), push(BOOTH), push(BUILDING));
    const layout = toSheetStackLayout(task, CARDS);
    expect(kinds(layout.bodies)).toEqual(['chip']);
    expect(kinds(layout.cards)).toEqual(['event', 'skku_building']);
  });

  it('keeps one card per kind, the topmost', () => {
    const task = run(push(BOOTH), push(BUILDING), push({ ...BOOTH, placeId: 'eskara26-booth-9' }));
    const layout = toSheetStackLayout(task, CARDS);
    expect(layout.cards.map((e) => e.request)).toEqual([
      { ...BOOTH, placeId: 'eskara26-booth-9' },
      BUILDING,
    ]);
  });

  it('chains every place as a body under the new shell', () => {
    const task = run(push(CHIP), push(BOOTH), push(BUILDING));
    const layout = toSheetStackLayout(task, BODIES);
    expect(kinds(layout.bodies)).toEqual(['chip', 'event', 'skku_building']);
    expect(layout.cards).toEqual([]);
  });

  it('leaves out an entry of a kind with no view, which opens nothing', () => {
    const task = run(push(LINE), push(CHIP));
    expect(kinds(toSheetStackLayout(task, CARDS).bodies)).toEqual(['chip']);
  });
});

describe('profileOf: what a view brings to the inline sheet', () => {
  it("is the swap view's profile, and null for a card or a missing view", () => {
    expect(profileOf(BODIES.line)).toBe(MAP_SHEET_PROFILES.route);
    expect(profileOf(CARDS.skku_building)).toBeNull();
    expect(profileOf(undefined)).toBeNull();
  });
});

describe('initialDetentOf', () => {
  it("is the profile's opening level, and min for a card or a missing view", () => {
    expect(initialDetentOf(BODIES.skku_building, BUILDING)).toBe('max');
    expect(initialDetentOf(BODIES.event, BOOTH)).toBe('min');
    expect(initialDetentOf(BODIES.line, LINE)).toBe('mid');
    expect(initialDetentOf(CARDS.skku_building, BUILDING)).toBe('min');
    expect(initialDetentOf(undefined, BUILDING)).toBe('min');
  });

  it("is the view's own answer for a request where it has one: a place that names only an area opens at max", () => {
    const event = { ...BODIES.event!, openingOf: (r: MapSheetRequest) => (r.kind === 'event' && r.area ? 'max' : 'min') } as const;
    expect(initialDetentOf(event, { ...BOOTH, area: true })).toBe('max');
    expect(initialDetentOf(event, BOOTH)).toBe('min');
  });
});

describe('positionOf: the inline sheet under a body', () => {
  const ROOT: SheetPosition = { kind: 'expandable', detents: ['small', 'medium', 'large'], initial: 'large' };
  const ROOT_WITH_HEIGHTS: SheetPosition = {
    kind: 'expandable',
    detents: ['small', 'medium', 'large'],
    heights: { small: '20%', medium: '35%' },
  };

  it('is the root itself at the root', () => {
    expect(positionOf(null, ROOT)).toBe(ROOT);
  });

  it("keeps the root's opening index, so gorhom does not snap on the push", () => {
    expect(positionOf(MAP_SHEET_PROFILES.list, ROOT)).toEqual({
      kind: 'expandable',
      detents: ['small', 'medium', 'large'],
      initial: 'large',
      heights: undefined,
    });
  });

  it("inherits the root's heights for a profile that declares none, so the list sits where the root does", () => {
    expect(positionOf(MAP_SHEET_PROFILES.list, ROOT_WITH_HEIGHTS)).toEqual({
      kind: 'expandable',
      detents: ['small', 'medium', 'large'],
      initial: undefined,
      heights: { small: '20%', medium: '35%' },
    });
    expect(positionOf(MAP_SHEET_PROFILES.list, { kind: 'stuck', detent: 'large' })).toEqual({
      kind: 'expandable',
      detents: ['small', 'medium', 'large'],
      initial: undefined,
      heights: undefined,
    });
  });
});

describe('the profiles: their levels and where each opens', () => {
  it('every profile moves between levels low to high, opens at one of them, and has a page only as its last', () => {
    const rank = { min: 0, mid: 1, max: 2, page: 3 } as const;
    for (const profile of Object.values(MAP_SHEET_PROFILES)) {
      const ranks = profile.levels.map((level) => rank[level]);
      expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
      expect(profile.levels).toContain(profile.opening);
      expect(profile.levels[0]).toBe('min');
      expect(profile.levels.slice(0, -1)).not.toContain('page');
    }
  });

  it('the transit root opens at max, under the world chrome', () => {
    expect(MAP_SHEET_PROFILES.transitRoot).toMatchObject({ chrome: 'world', levels: ['min', 'mid', 'max'], opening: 'max' });
  });

  it('every tab root has mid, where the control row parks, and 이번 주 opens there', () => {
    for (const root of [MAP_SHEET_PROFILES.campusRoot, MAP_SHEET_PROFILES.thisWeekRoot, MAP_SHEET_PROFILES.transitRoot]) {
      expect(root.levels).toContain('mid');
    }
    expect(MAP_SHEET_PROFILES.thisWeekRoot.opening).toBe('mid');
  });
});

describe('the profiles: what each level presents (ADR 0022 d3)', () => {
  const WORLD = { lens: 'everything', chrome: 'world', body: 'full', framing: { kind: 'keep' }, surface: 'glass', listScrolls: false };

  it('a line shows its stops and labels with a header alone at min, its stops without labels at mid, under the task field, and the route alone at the page', () => {
    const route = MAP_SHEET_PROFILES.route;
    expect(presentationAt(route, 'min')).toEqual({
      lens: 'routeWithStopsAndLabels',
      chrome: 'taskField',
      body: 'headerOnly',
      framing: { kind: 'fit', margin: { top: 48, bottom: 24 } },
      surface: 'glass',
      listScrolls: false,
    });
    expect(presentationAt(route, 'mid')).toEqual({
      lens: 'routeWithStops',
      chrome: 'taskField',
      body: 'full',
      framing: { kind: 'fit', margin: { top: 12, bottom: 12 } },
      surface: 'glass',
      listScrolls: false,
    });
    expect(presentationAt(route, 'page')).toEqual({
      lens: 'routeOnly',
      chrome: 'none',
      body: 'full',
      framing: { kind: 'keep' },
      surface: 'solid',
      listScrolls: true,
    });
    expect(route.levels).toEqual(['min', 'mid', 'page']);
  });

  it('a stop focuses its pin under the task field at every level, and its list scrolls at its top', () => {
    for (const level of ['min', 'mid'] as const) {
      expect(presentationAt(MAP_SHEET_PROFILES.stop, level)).toEqual({
        lens: 'focusedStop',
        chrome: 'taskField',
        body: 'full',
        framing: { kind: 'keep' },
        surface: 'glass',
        listScrolls: false,
      });
    }
    expect(presentationAt(MAP_SHEET_PROFILES.stop, 'max').listScrolls).toBe(true);
  });

  it('a place, a peek and a list keep the world chrome, as a tab root does', () => {
    for (const name of ['place', 'peek', 'list'] as const) {
      expect(presentationAt(MAP_SHEET_PROFILES[name], 'min')).toEqual(WORLD);
      expect(presentationAt(MAP_SHEET_PROFILES[name], 'max')).toEqual({ ...WORLD, surface: 'solid', listScrolls: true });
    }
    expect(ROOT_PRESENTATION).toEqual(WORLD);
  });

  it('every profile is glass at min and mid and solid at max and its page, roots and pushed sheets alike', () => {
    const expected = { min: 'glass', mid: 'glass', max: 'solid', page: 'solid' } as const;
    for (const profile of Object.values(MAP_SHEET_PROFILES)) {
      for (const level of profile.levels) expect(presentationAt(profile, level).surface).toBe(expected[level]);
    }
  });
});

describe('presentationAt: what the top entry’s settled level presents', () => {
  it('keeps one object per profile and level, so a settle hands a view the same presentation', () => {
    expect(presentationAt(MAP_SHEET_PROFILES.route, 'min')).toBe(presentationAt(MAP_SHEET_PROFILES.route, 'min'));
  });

  it('is the world at the root', () => {
    expect(presentationAt(null, 'mid')).toBe(ROOT_PRESENTATION);
  });
});

describe('floatingInset: the gap under a card that floats', () => {
  it('is the inset for a position whose top is not large, and 0 for one that attaches', () => {
    expect(floatingInset({ kind: 'expandable', detents: ['small', 'medium'] }, 8)).toBe(8);
    expect(floatingInset({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 8)).toBe(0);
    expect(floatingInset({ kind: 'stuck', detent: 'medium' }, 8)).toBe(8);
    expect(floatingInset({ kind: 'stuck', detent: 'large' }, 8)).toBe(0);
    expect(floatingInset({ kind: 'stuck', height: '99%' }, 8)).toBe(8);
    expect(floatingInset({ kind: 'fit' }, 8)).toBe(8);
  });

  it('is 0 wherever no card floats', () => {
    expect(floatingInset({ kind: 'expandable', detents: ['small', 'medium'] }, 0)).toBe(0);
  });
});

describe('topProfile: the topmost body decides the sheet', () => {
  it("is the topmost swap body's profile, whatever card floats above it", () => {
    const task = run(push(LINE), push(CHIP), push(BOOTH));
    expect(topProfile(toSheetStackLayout(task, BODIES), BODIES)).toBe(MAP_SHEET_PROFILES.peek);
    expect(topProfile(toSheetStackLayout(task, CARDS), CARDS)).toBe(MAP_SHEET_PROFILES.list);
  });

  it('is null at the root', () => {
    expect(topProfile(toSheetStackLayout(EMPTY_TASK, BODIES), BODIES)).toBeNull();
    expect(topProfile(toSheetStackLayout(run(push(BOOTH)), CARDS), CARDS)).toBeNull();
  });
});

describe('locateAnchorTopOf: where the lower control row parks as the sheet rises', () => {
  it("is the top edge of the root's park detent, so a taller sheet covers the row", () => {
    const campus = { kind: 'expandable', detents: ['small', 'medium', 'large'], heights: { small: '20%', medium: '35%' } } as const;
    expect(locateAnchorTopOf(campus, 'medium', 800, SDS)).toBe(520);
    expect(locateAnchorTopOf(campus, 'small', 800, SDS)).toBe(640);
  });

  it("parks the transit root's row at small, under a panel whose medium sits just below the chips", () => {
    const panel: SheetPosition = { ...PANEL, heights: { medium: 850 } };
    expect(locateAnchorTopOf(panel, 'small', 1000, SDS)).toBe(550);
  });

  it('measures a floating two-detent root from its own, shorter container plus the gap under it', () => {
    // The card's container is 1000 - 8; small is 45% of that, and the card sits 8 above the bottom.
    const panel: SheetPosition = { ...PANEL, heights: { medium: 842 } };
    expect(locateAnchorTopOf(panel, 'small', 1000, SDS, 8)).toBeCloseTo(1000 - (992 * 0.45 + 8));
    // The anchor the host reads at the opening detent lands exactly under the controls.
    expect(locateAnchorTopOf(panel, 'medium', 1000, SDS, 8)).toBe(150);
  });

  it('ignores the float inset for a sheet that attaches at large', () => {
    const campus = { kind: 'expandable', detents: ['small', 'medium', 'large'], heights: { small: '20%' } } as const;
    expect(locateAnchorTopOf(campus, 'small', 800, SDS, 8)).toBe(640);
  });

  it("reads SDS's own height when the position does not override it, and a point height as points", () => {
    expect(locateAnchorTopOf({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 'medium', 1000, SDS)).toBe(350);
    expect(locateAnchorTopOf({ kind: 'expandable', detents: ['medium', 'large'], heights: { medium: 300 } }, 'medium', 800, SDS)).toBe(500);
  });

  it('parks at the lowest detent when the position lacks the one asked for, and never above the container', () => {
    expect(locateAnchorTopOf({ kind: 'expandable', detents: ['small', 'large'] }, 'medium', 1000, SDS)).toBe(550);
    expect(locateAnchorTopOf({ kind: 'expandable', detents: ['medium', 'large'] }, 'large', 1000, SDS)).toBe(0);
    expect(locateAnchorTopOf({ kind: 'stuck', detent: 'large' }, 'medium', 800, SDS)).toBe(0);
    expect(locateAnchorTopOf({ kind: 'fit' }, 'medium', 800, SDS)).toBe(0);
  });
});

describe('restingInsetOf: the height a sheet covers at its opening detent', () => {
  it("is the position's own height for the opening detent, in the container's points", () => {
    // Arrange
    const panel = PANEL;

    // Act & Assert
    expect(restingInsetOf(panel, 'medium', 800, SDS)).toBe(650);
    expect(restingInsetOf({ kind: 'expandable', detents: ['medium', 'large'], heights: { medium: 300 } }, 'medium', 800, SDS)).toBe(300);
  });

  it("is SDS's own percentage where the position does not override the detent", () => {
    // Act & Assert
    expect(restingInsetOf({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 'small', 1000, SDS)).toBe(450);
    expect(restingInsetOf({ kind: 'expandable', detents: ['small', 'medium', 'large'], heights: { small: '20%' } }, 'medium', 1000, SDS)).toBe(650);
  });

  it('is 0 at large, which covers the whole map and leaves nothing to frame in', () => {
    // Act & Assert
    expect(restingInsetOf({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 'large', 1000, SDS)).toBe(0);
    expect(restingInsetOf({ kind: 'stuck', detent: 'large' }, 'small', 1000, SDS)).toBe(0);
  });

  it("is a stuck sheet's own detent or height, whatever opening is asked for", () => {
    // Act & Assert
    expect(restingInsetOf({ kind: 'stuck', detent: 'medium' }, 'small', 1000, SDS)).toBe(650);
    expect(restingInsetOf({ kind: 'stuck', height: 300 }, 'large', 1000, SDS)).toBe(300);
    expect(restingInsetOf({ kind: 'stuck', height: '40%' }, 'large', 1000, SDS)).toBe(400);
  });

  it('is 0 for a sheet that fits its content, and before the container is measured', () => {
    // Act & Assert
    expect(restingInsetOf({ kind: 'fit' }, 'medium', 1000, SDS)).toBe(0);
    expect(restingInsetOf({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 'medium', 0, SDS)).toBe(0);
    expect(restingInsetOf({ kind: 'stuck', height: 300 }, 'medium', 0, SDS)).toBe(0);
  });

  it('measures a floating two-detent root as its height in its own container plus the gap under it, so its top lands under the controls', () => {
    // Arrange
    const panel = PANEL_FLOATING;

    // Act & Assert
    expect(restingInsetOf(panel, 'medium', 800, SDS, 8)).toBe(650);
    expect(restingInsetOf(panel, 'small', 800, SDS, 8)).toBeCloseTo(792 * 0.45 + 8);
    expect(restingInsetOf({ kind: 'stuck', height: 300 }, 'medium', 800, SDS, 8)).toBe(308);
  });

  it('ignores the float inset for a sheet that attaches at large', () => {
    expect(restingInsetOf({ kind: 'expandable', detents: ['small', 'medium', 'large'] }, 'small', 1000, SDS, 8)).toBe(450);
  });
});

describe('bodyLabelOf: what a screen reader calls the inline sheet', () => {
  it('names the topmost body, whatever card floats above it', () => {
    const task = run(push(CHIP), push(BOOTH));
    expect(bodyLabelOf(toSheetStackLayout(task, CARDS), CARDS)).toBe('map.sheet.a11y.list');
    expect(bodyLabelOf(toSheetStackLayout(task, BODIES), BODIES)).toBe('map.sheet.a11y.place');
  });

  it('is null at the root, which the tab names', () => {
    expect(bodyLabelOf(toSheetStackLayout(run(push(BOOTH)), CARDS), CARDS)).toBeNull();
  });
});

describe('tabSwitchSnap: how a tab switch moves the incoming sheet', () => {
  // The map tab's sheet at medium (38% of 874) coming in over the transit panel's top.
  const SETTLED = { containerHeight: 874, outgoingTop: 217, ownTop: 541.88, live: 'mid' as MapDetent | null, aimed: null, reported: true };

  it('starts at the outgoing height and moves to the level the sheet is at', () => {
    expect(tabSwitchSnap(SETTLED)).toEqual({ startHeight: 657, level: 'mid' });
  });

  it('moves to the level a snap sent the sheet to while its tab was hidden', () => {
    expect(tabSwitchSnap({ ...SETTLED, aimed: 'min' })).toEqual({ startHeight: 657, level: 'min' });
  });

  it('leaves a sheet that has not reported a detent alone, so a tab opened for the first time keeps its sheet', () => {
    // A cold start on the transit tab, then the map tab: its sheet mounts with the switch, at the seeds.
    expect(tabSwitchSnap({ ...SETTLED, ownTop: 874, live: 'min', reported: false })).toBeNull();
  });

  it('leaves the sheet alone under an outgoing sheet that is unmeasured or closed', () => {
    expect(tabSwitchSnap({ ...SETTLED, outgoingTop: 0 })).toBeNull();
    expect(tabSwitchSnap({ ...SETTLED, outgoingTop: 874 })).toBeNull();
  });

  it('leaves a closed sheet closed, and a sheet already at the outgoing height where it is', () => {
    expect(tabSwitchSnap({ ...SETTLED, live: null })).toBeNull();
    expect(tabSwitchSnap({ ...SETTLED, ownTop: 217 })).toBeNull();
  });

  it('keeps the remembered-height switch for the two-level transit root at its top', () => {
    // The transit root at max (its top) coming in over the map tab's sheet.
    expect(tabSwitchSnap({ containerHeight: 874, outgoingTop: 541.88, ownTop: 217, live: 'max', aimed: null, reported: true })).toEqual({
      startHeight: 874 - 541.88,
      level: 'max',
    });
  });
});

describe('coversTabBarOf: a tab root under the tab bar, a sheet opened from it over the bar', () => {
  it('keeps the floating tab bar over a tab root, and draws a sheet opened from it over the bar', () => {
    expect(coversTabBarOf(true)).toBe(false);
    expect(coversTabBarOf(false)).toBe(true);
  });
});

describe('framingDetentOf: the detent the host pads and frames for', () => {
  it('is the settled level where the route profile fits there, and the opening level at the page, which keeps the camera', () => {
    expect(framingDetentOf(MAP_SHEET_PROFILES.route, 'min')).toBe('min');
    expect(framingDetentOf(MAP_SHEET_PROFILES.route, 'mid')).toBe('mid');
    expect(framingDetentOf(MAP_SHEET_PROFILES.route, 'page')).toBe('mid');
  });

  it('is the opening level before the sheet has settled anywhere', () => {
    expect(framingDetentOf(MAP_SHEET_PROFILES.route, null)).toBe('mid');
  });

  it('is the opening level at every level of a profile that never fits, so a drag re-frames nothing there', () => {
    for (const level of ['min', 'mid', 'max'] as const) {
      expect(framingDetentOf(MAP_SHEET_PROFILES.stop, level)).toBe('mid');
    }
  });

  it('is null at the root, which has no profile', () => {
    expect(framingDetentOf(null, 'min')).toBeNull();
  });
});

describe('decideSheetMove: the one rule that moves the inline sheet', () => {
  const settle = (detent: MapDetent): MapTaskAction => ({ type: 'setDetent', detent });
  const LEVELS: readonly MapDetent[] = ['min', 'mid', 'max'];
  const nowOf = (task: MapTaskState, extra: { rootDetent?: MapDetent | null; levels?: readonly MapDetent[]; snapKey?: string } = {}) => ({
    layout: toSheetStackLayout(task, BODIES),
    levels: extra.levels ?? LEVELS,
    snapKey: extra.snapKey ?? 'k',
    rootDetent: extra.rootDetent ?? null,
  });
  const seenOf = (task: MapTaskState) => decideSheetMove(null, nowOf(task), null).seen;
  const moveAfter = (
    before: MapTaskState,
    action: MapTaskAction,
    extra: Parameters<typeof nowOf>[1] = {},
    reported: { id: number; detent: MapDetent } | null = null,
  ) => decideSheetMove(seenOf(before), nowOf(reduceMapTask(before, action), extra), reported).move;

  it('opens a body just pushed at the level its entry records, its opening', () => {
    // Arrange
    const before = run(push(CHIP), settle('min'));

    // Act
    const move = moveAfter(before, { type: 'push', request: BUILDING, key: keyOf(BUILDING), layers: {}, detent: 'max' });

    // Assert
    expect(move).toEqual({ kind: 'snap', to: 'max', cause: 'open', deferFrame: false });
  });

  it('returns a body a pop reveals to the level it recorded, not its opening', () => {
    // Arrange
    const before = run(push(CHIP), settle('min'), push(BUILDING), settle('max'));

    // Act & Assert
    expect(moveAfter(before, { type: 'pop' })).toEqual({ kind: 'snap', to: 'min', cause: 'reveal', deferFrame: false });
  });

  it('returns the root to the level it last settled at when the sheet over it closes, on a pop or a re-tap', () => {
    const line = run(push(LINE), settle('mid'));
    expect(moveAfter(line, { type: 'pop' }, { rootDetent: 'min' })).toMatchObject({ to: 'min', cause: 'reveal' });
    const stack = run(push(CHIP), push(BUILDING), settle('max'));
    expect(moveAfter(stack, { type: 'popToRoot' }, { rootDetent: 'mid' })).toMatchObject({ to: 'mid', cause: 'reveal' });
  });

  it('leaves the root where it is when it has not settled anywhere yet', () => {
    expect(moveAfter(run(push(LINE)), { type: 'pop' }, { rootDetent: null })).toEqual({ kind: 'stay' });
  });

  it('opens a stack replaced from outside the tab at its new top', () => {
    const before = run(push(LINE), settle('min'));
    expect(moveAfter(before, { type: 'open', request: CHIP, key: keyOf(CHIP), layers: {}, detent: 'mid' })).toMatchObject({ to: 'mid', cause: 'open' });
  });

  it('follows a level written onto the top entry by someone else: the back key collapsing it', () => {
    // The sheet itself last reported the line at its page; the back key wrote mid.
    const line = run(push(LINE), settle('page'));
    const top = line.stack[0]!;
    expect(moveAfter(line, settle('mid'), {}, { id: top.id, detent: 'page' })).toMatchObject({ to: 'mid', cause: 'follow' });
  });

  it("moves nothing when the sheet's own settle is written onto its entry", () => {
    const line = run(push(LINE), settle('mid'));
    const top = line.stack[0]!;
    expect(moveAfter(line, settle('min'), {}, { id: top.id, detent: 'min' })).toEqual({ kind: 'stay' });
  });

  it('moves nothing while the same top stays, a camera settle replacing the task included', () => {
    const line = run(push(LINE), settle('mid'));
    expect(moveAfter(line, { type: 'rememberCamera', camera: { latitude: 37.5, longitude: 127, zoom: 14, tilt: 0, bearing: 0 } })).toEqual({
      kind: 'stay',
    });
  });

  it('keeps the level by name when the levels change under the same top', () => {
    const line = run(push(LINE), settle('mid'));
    expect(moveAfter(line, settle('mid'), { levels: ['min', 'mid'] })).toMatchObject({ to: 'mid', cause: 'restack' });
  });

  it('defers a move a frame when the snap points changed in the same commit', () => {
    const before = run(push(CHIP), settle('min'));
    expect(moveAfter(before, push(LINE), { snapKey: 'other' })).toMatchObject({ cause: 'open', deferFrame: true });
  });

  it('opens a stack the sheet mounts with at its top, and nothing at a bare root', () => {
    expect(decideSheetMove(null, nowOf(run(push(LINE))), null).move).toEqual({ kind: 'snap', to: 'mid', cause: 'open', deferFrame: false });
    expect(decideSheetMove(null, nowOf(EMPTY_TASK), null).move).toEqual({ kind: 'stay' });
  });
});
