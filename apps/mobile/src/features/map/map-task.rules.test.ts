/**
 * A tab's task as a sheet stack (ADR 0022): what each action does to the stack,
 * what the map reads off it, and what the back key does at each depth.
 */

import { describe, it, expect } from 'vitest';
import { SHEET_KIND_HOME_TAB } from './map-tabs.constants';
import type { MapOverlay, MapPlace } from './overlay.types';
import type { MapCameraSnapshot, MapSheetRequest, MapTaskState } from './sheet-stack.types';
import type { MapSheetPlace, MapSheetViewTable } from './sheet-views.types';
import {
  EMPTY_TASK,
  activeChip,
  cameraOnReveal,
  decideBack,
  decideLinkArrival,
  toLinkOpening,
  dismissAction,
  fedKindOf,
  fedPlaceLayers,
  sheetTabFor,
  toMapSheetKey,
  reduceMapTask,
  revealedCamera,
  toSheetRequest,
  toPlaceRequest,
  toSheetRequestFromTap,
  topEntry,
  topmostEntry,
  topmostLayerLens,
  type MapTaskAction,
} from './map-task.rules';

const BUILDING: MapSheetRequest = {
  kind: 'skku_building',
  placeId: '31',
  highlightSpaceCd: null,
  source: 'pin',
};
const OTHER_BUILDING: MapSheetRequest = { ...BUILDING, placeId: '2' };
const BOOTH: MapSheetRequest = { kind: 'event', placeId: 'eskara26-booth-3', source: 'pin' };
const BAR_CHIP: MapSheetRequest = { kind: 'chip', chipId: 'eskara26_view_bar' };
const BAR_LAYERS = { eskara26_bar: true, eskara26_stage: false };
const STAGE_CHIP: MapSheetRequest = { kind: 'chip', chipId: 'eskara26_view_stage' };
const STAGE_LAYERS = { eskara26_bar: false, eskara26_stage: true };
const LINE: MapSheetRequest = { kind: 'line', groupId: 'hssc', source: 'tab' };
const STOP: MapSheetRequest = { kind: 'bus_stop', stopId: '01-123', source: 'line_sheet' };

const CAMERA_A: MapCameraSnapshot = { latitude: 37.58, longitude: 126.99, zoom: 16, tilt: 0, bearing: 0 };
const CAMERA_B: MapCameraSnapshot = { latitude: 37.29, longitude: 126.97, zoom: 17, tilt: 0, bearing: 0 };

/**
 * The key each kind's owner names (`keyOf` on its view). The map's own kinds
 * use the map's rule; the transit kinds stand in for transit's, which its own
 * tests hold. To the reducer a key is opaque: the same key on top is the same sheet.
 */
function keyOf(request: MapSheetRequest): string {
  switch (request.kind) {
    case 'line':
      return `line:${request.groupId}`;
    case 'bus_stop':
      return `bus_stop:${request.stopId}`;
    case 'subway_station':
      return `subway_station:${request.stationId}`;
    default:
      return toMapSheetKey(request);
  }
}

const push = (request: MapSheetRequest, layers: Record<string, boolean> = {}, key = keyOf(request)): MapTaskAction => ({
  type: 'push',
  request,
  key,
  layers,
  detent: 'mid',
});
const select = (request: MapSheetRequest, layers: Record<string, boolean> = {}): MapTaskAction => ({
  type: 'select',
  request,
  key: keyOf(request),
  layers,
  detent: 'mid',
});
/** A chip that is on: its narrowing is the entry's layers, so the push carries it. */
const chipEntry = (request: MapSheetRequest, layers: Record<string, boolean>): MapTaskAction =>
  push(request, layers);

const run = (...actions: MapTaskAction[]): MapTaskState => actions.reduce(reduceMapTask, EMPTY_TASK);
const kinds = (task: MapTaskState) => task.stack.map((e) => e.request.kind);

describe('push', () => {
  it('stacks a request with a fresh id and no camera yet', () => {
    const task = run(push(BUILDING));
    expect(task.stack).toEqual([
      { id: 0, request: BUILDING, key: 'skku_building:31:', layers: {}, detent: 'mid', camera: null, framed: false },
    ]);
    expect(task.nextId).toBe(1);
  });

  it('is a no-op when the same key is already on top', () => {
    const once = run(push(BUILDING));
    expect(reduceMapTask(once, push({ ...BUILDING }))).toBe(once);
  });

  it('is a no-op for a request reached another way under the same key: only the owner says what makes one sheet', () => {
    const once = run(push(STOP));
    expect(reduceMapTask(once, push({ kind: 'bus_stop', stopId: '01-123', source: 'deeplink' }, {}, 'bus_stop:01-123'))).toBe(
      once,
    );
  });

  it('stacks a different key, whatever the requests share', () => {
    expect(kinds(run(push(BUILDING), push(OTHER_BUILDING)))).toEqual(['skku_building', 'skku_building']);
    expect(kinds(run(push(STOP), push(STOP, {}, 'another-stop')))).toEqual(['bus_stop', 'bus_stop']);
  });

  it('stacks the same place again when something else is on top of it', () => {
    expect(kinds(run(push(BUILDING), push(BOOTH), push(BUILDING)))).toEqual([
      'skku_building',
      'event',
      'skku_building',
    ]);
  });
});

describe('framed: the top sheet has placed its camera', () => {
  const CAMERA = { latitude: 37.58, longitude: 126.99, zoom: 14, tilt: 0, bearing: 0 };

  it('marks the top alone, and a settle before the frame does not count as one', () => {
    const task = run(push(LINE), { type: 'rememberCamera', camera: CAMERA }, push(STOP), { type: 'framed' });
    expect(task.stack.map((e) => e.framed)).toEqual([false, true]);
    expect(task.stack[0]?.camera).toEqual(CAMERA);
  });

  it('is a no-op on a top already framed, and on an empty stack', () => {
    const once = run(push(LINE), { type: 'framed' });
    expect(reduceMapTask(once, { type: 'framed' })).toBe(once);
    expect(reduceMapTask(EMPTY_TASK, { type: 'framed' })).toBe(EMPTY_TASK);
  });

  it('survives a pop back onto the entry', () => {
    const task = run(push(LINE), { type: 'framed' }, push(STOP), { type: 'pop' });
    expect(topEntry(task)?.framed).toBe(true);
  });
});

describe('open: a request from outside the tab lands on a clean stack', () => {
  const open = (request: MapSheetRequest): MapTaskAction => ({ type: 'open', request, key: keyOf(request), layers: {}, detent: 'mid' });

  it('replaces a line and the stop over it with the linked line: the field names what the map shows', () => {
    const task = run(push(LINE), push(STOP), open({ kind: 'line', groupId: 'jongro07', source: 'deeplink' }));
    expect(kinds(task)).toEqual(['line']);
    expect(topEntry(task)?.request).toEqual({ kind: 'line', groupId: 'jongro07', source: 'deeplink' });
  });

  it('keeps counting ids past the entries it dropped', () => {
    const task = run(push(LINE), push(STOP), open(LINE));
    expect(task.stack[0]?.id).toBe(2);
  });

  it('is a push onto an empty stack', () => {
    expect(run(open(STOP)).stack).toEqual(run(push(STOP)).stack);
  });
});

describe('decideLinkArrival: only an arrival from outside the app starts the task over', () => {
  it.each([undefined, 'deeplink', 'push', 'miniapp', 'webview', 'game'] as const)(
    'a place asked for by %s starts over',
    (source) => {
      // Act & Assert
      expect(decideLinkArrival(source)).toBe('startOver');
    },
  );

  it.each(['search', 'place_sheet', 'chip', 'sdui', 'home_tile', 'list', 'other'] as const)(
    'a place asked for in the app, by %s, opens on top of what is open',
    (source) => {
      // Act & Assert
      expect(decideLinkArrival(source)).toBe('onTop');
    },
  );

  it('a station linked from outside over an open stop is alone on the stack, so the field names the station', () => {
    // Arrange
    const station: MapSheetRequest = { kind: 'subway_station', stationId: 'hyehwa', source: 'deeplink' };
    const arrived: MapTaskAction[] = decideLinkArrival(undefined) === 'startOver' ? [{ type: 'popToRoot' }] : [];

    // Act
    const task = run(push(LINE), push(STOP), ...arrived, select(station));

    // Assert
    expect(kinds(task)).toEqual(['subway_station']);
  });

  it("a place sheet's own map action swaps the place and keeps the chip under it", () => {
    // Arrange
    const other: MapSheetRequest = { kind: 'event', placeId: 'eskara26-booth-9', source: 'place_sheet' };
    const before = run(chipEntry(BAR_CHIP, BAR_LAYERS), select(BOOTH));
    const open = topmostEntry(before, 'event');
    const arrived: MapTaskAction[] =
      decideLinkArrival('place_sheet') === 'startOver' ? [{ type: 'popToRoot' }] : open ? [{ type: 'dismiss', id: open.id }] : [];

    // Act
    const task = [...arrived, select(other)].reduce(reduceMapTask, before);

    // Assert
    expect(kinds(task)).toEqual(['chip', 'event']);
    expect(topEntry(task)?.request).toEqual(other);
  });

  it('a chip the same outside link names lands on the clean stack, and the place opens over it', () => {
    // Act
    const task = run(push(STOP), { type: 'popToRoot' }, chipEntry(BAR_CHIP, BAR_LAYERS), select(BOOTH));

    // Assert
    expect(kinds(task)).toEqual(['chip', 'event']);
  });
});

describe('toLinkOpening: how a tab that opens a place link at once joins it to its stack', () => {
  it.each([undefined, 'deeplink', 'push', 'miniapp', 'webview'] as const)('a place from outside the app, by %s, opens on a clean stack', (source) => {
    // Act & Assert
    expect(toLinkOpening(source)).toBe('open');
  });

  it.each(['search', 'place_sheet', 'chip'] as const)('a place asked for in the app, by %s, opens like a pin (ADR 0022 d1)', (source) => {
    // Act & Assert
    expect(toLinkOpening(source)).toBe('select');
  });

  it('a stop found by search over an open line stacks on it, so back returns to the line', () => {
    // Arrange
    const found: MapSheetRequest = { kind: 'bus_stop', stopId: '01-555', source: 'search' };
    const how = toLinkOpening('search');

    // Act
    const task = run(push(LINE), { type: how, request: found, key: keyOf(found), layers: {}, detent: 'mid' });

    // Assert
    expect(kinds(task)).toEqual(['line', 'bus_stop']);
  });
});

describe('select: a pin opens where the user is', () => {
  it('replaces a top of the same kind, with a new entry', () => {
    const task = run(push(BUILDING), select(OTHER_BUILDING));
    expect(task.stack).toHaveLength(1);
    expect(topEntry(task)?.request).toEqual(OTHER_BUILDING);
    expect(topEntry(task)?.id).toBe(1);
  });

  it('pushes over a top of another kind', () => {
    expect(kinds(run(push(LINE), select(STOP)))).toEqual(['line', 'bus_stop']);
  });

  it('pushes onto an empty stack', () => {
    expect(kinds(run(select(BOOTH)))).toEqual(['event']);
  });

  it('replaces even an identical top, so re-tapping a chip starts it over', () => {
    const once = run(chipEntry(BAR_CHIP, BAR_LAYERS));
    const again = reduceMapTask(once, select(BAR_CHIP, BAR_LAYERS));
    expect(again).not.toBe(once);
    expect(topEntry(again)?.id).not.toBe(topEntry(once)?.id);
  });
});

describe('pop and popToRoot', () => {
  it('pop removes the top alone', () => {
    expect(kinds(run(push(LINE), push(STOP), { type: 'pop' }))).toEqual(['line']);
  });

  it('pop on an empty stack changes nothing', () => {
    expect(reduceMapTask(EMPTY_TASK, { type: 'pop' })).toBe(EMPTY_TASK);
  });

  it('popToRoot empties the stack and keeps the id counter moving', () => {
    const task = run(push(LINE), push(STOP), { type: 'popToRoot' });
    expect(task.stack).toEqual([]);
    expect(reduceMapTask(task, push(BUILDING)).stack[0]?.id).toBe(2);
  });
});

describe('releaseChip: a reset chip ends the narrowing, not the task above it', () => {
  it('removes the topmost chip entry and keeps what is above and below it', () => {
    const task = run(push(BUILDING), chipEntry(BAR_CHIP, BAR_LAYERS), push(LINE), { type: 'releaseChip' });
    expect(kinds(task)).toEqual(['skku_building', 'line']);
  });

  it('removes only the topmost of two chips', () => {
    const task = run(
      chipEntry(STAGE_CHIP, STAGE_LAYERS),
      push(BOOTH),
      chipEntry(BAR_CHIP, BAR_LAYERS),
      { type: 'releaseChip' },
    );
    expect(task.stack.map((e) => e.request)).toEqual([STAGE_CHIP, BOOTH]);
  });

  it('changes nothing when no chip is on', () => {
    const task = run(push(BUILDING));
    expect(reduceMapTask(task, { type: 'releaseChip' })).toBe(task);
  });
});

describe('setDetent and rememberCamera write the top entry', () => {
  it('setDetent changes the top alone', () => {
    const task = run(push(LINE), push(STOP), { type: 'setDetent', detent: 'max' });
    expect(task.stack.map((e) => e.detent)).toEqual(['mid', 'max']);
  });

  it('rememberCamera changes the top alone', () => {
    const task = run(push(LINE), { type: 'rememberCamera', camera: CAMERA_A }, push(STOP), {
      type: 'rememberCamera',
      camera: CAMERA_B,
    });
    expect(task.stack.map((e) => e.camera)).toEqual([CAMERA_A, CAMERA_B]);
  });

  it('rememberCamera of the camera already recorded returns the same task', () => {
    // Arrange: a follow-mode settle that reports the camera the top already holds.
    const before = run(push(LINE), { type: 'rememberCamera', camera: CAMERA_A });

    // Act
    const after = reduceMapTask(before, { type: 'rememberCamera', camera: { ...CAMERA_A } });

    // Assert
    expect(after).toBe(before);
  });

  it('rememberCamera of a camera that moved at all records it', () => {
    // Arrange
    const before = run(push(LINE), { type: 'rememberCamera', camera: CAMERA_A });
    const moved = { ...CAMERA_A, latitude: CAMERA_A.latitude + 1e-9 };

    // Act
    const after = reduceMapTask(before, { type: 'rememberCamera', camera: moved });

    // Assert
    expect(topEntry(after)?.camera).toEqual(moved);
  });

  it('both change nothing on an empty stack', () => {
    expect(reduceMapTask(EMPTY_TASK, { type: 'setDetent', detent: 'max' })).toBe(EMPTY_TASK);
    expect(reduceMapTask(EMPTY_TASK, { type: 'rememberCamera', camera: CAMERA_A })).toBe(EMPTY_TASK);
  });

  it('keeps the request object, so a reader holding it sees the same sheet', () => {
    const before = run(chipEntry(BAR_CHIP, BAR_LAYERS));
    const after = reduceMapTask(before, { type: 'setDetent', detent: 'min' });
    expect(topEntry(after)?.request).toBe(topEntry(before)?.request);
  });
});

describe('the suggestion card', () => {
  const SWITCH = { campus: 'nsc', label: '자과캠', variant: 'switch' } as const;

  it('suggest sets the card and leaves the dismissal alone', () => {
    const dismissed = run({ type: 'suggest', suggestion: SWITCH }, { type: 'dismissSuggestion' });
    const task = reduceMapTask(dismissed, { type: 'suggest', suggestion: null });
    expect(task.suggestion).toBeNull();
    expect(task.dismissedSuggestion).toBe('nsc:switch');
  });

  it('dismissSuggestion records the card as campus:variant and takes it down', () => {
    const task = run({ type: 'suggest', suggestion: SWITCH }, { type: 'dismissSuggestion' });
    expect(task.suggestion).toBeNull();
    expect(task.dismissedSuggestion).toBe('nsc:switch');
  });

  it('dismissSuggestion with no card changes nothing', () => {
    expect(reduceMapTask(EMPTY_TASK, { type: 'dismissSuggestion' })).toBe(EMPTY_TASK);
  });

  it('resetSuggestion clears the card and the dismissal', () => {
    const task = run(
      { type: 'suggest', suggestion: SWITCH },
      { type: 'dismissSuggestion' },
      { type: 'suggest', suggestion: { ...SWITCH, variant: 'show' } },
      { type: 'resetSuggestion' },
    );
    expect(task.suggestion).toBeNull();
    expect(task.dismissedSuggestion).toBeNull();
  });

  it('a settle that changes nothing leaves the task object alone', () => {
    // Every camera idle re-derives the card, so an equal card, a null over a
    // null and a reset with nothing to reset must not re-render the readers.
    const shown = run({ type: 'suggest', suggestion: SWITCH });
    expect(reduceMapTask(shown, { type: 'suggest', suggestion: { ...SWITCH } })).toBe(shown);
    expect(reduceMapTask(EMPTY_TASK, { type: 'suggest', suggestion: null })).toBe(EMPTY_TASK);
    expect(reduceMapTask(EMPTY_TASK, { type: 'resetSuggestion' })).toBe(EMPTY_TASK);
    expect(reduceMapTask(shown, { type: 'suggest', suggestion: { ...SWITCH, variant: 'show' } })).not.toBe(shown);
  });
});

describe('reading the stack', () => {
  it('topEntry is null on an empty stack', () => {
    expect(topEntry(EMPTY_TASK)).toBeNull();
  });

  it('activeChip is the topmost chip entry, even under another sheet, carrying its narrowing', () => {
    const chip = activeChip(
      run(chipEntry(STAGE_CHIP, STAGE_LAYERS), push(BOOTH), chipEntry(BAR_CHIP, BAR_LAYERS), push(LINE)),
    );
    expect(chip?.request).toBe(BAR_CHIP);
    expect(chip?.layers).toEqual(BAR_LAYERS);
    expect(activeChip(run(push(BOOTH)))).toBeNull();
  });

  it('topmostLayerLens lets the highest entry that names a layer win', () => {
    // A line opened over a chip draws its route even where the chip turned it off.
    const task = run(
      chipEntry({ kind: 'chip', chipId: 'c' }, { route_hssc: false, eskara26_bar: true }),
      push(LINE, { route_hssc: true }),
    );
    expect(topmostLayerLens(task)).toEqual({ route_hssc: true, eskara26_bar: true });
  });

  it('topmostLayerLens keeps a lower entry\'s layer under a sheet that names nothing', () => {
    expect(topmostLayerLens(run(push(LINE, { route_hssc: true }), push(STOP)))).toEqual({ route_hssc: true });
  });

  it('topmostLayerLens is empty with no sheet open', () => {
    expect(topmostLayerLens(EMPTY_TASK)).toEqual({});
  });

  it('revealedCamera is the camera the newly exposed sheet framed', () => {
    const task = run(
      push(LINE),
      { type: 'rememberCamera', camera: CAMERA_A },
      push(STOP),
      { type: 'rememberCamera', camera: CAMERA_B },
      { type: 'pop' },
    );
    expect(revealedCamera(task)).toEqual(CAMERA_A);
    expect(revealedCamera(EMPTY_TASK)).toBeNull();
  });
});

describe('decideBack: collapse, then pop, then home', () => {
  const initialDetentOf = (r: MapSheetRequest) => (r.kind === 'line' ? 'max' : 'mid');
  const at = (detent: 'min' | 'mid' | 'max') =>
    run(push(LINE), push(BOOTH), { type: 'setDetent', detent });

  it('collapses a top sheet raised above its initial detent to it', () => {
    expect(decideBack(at('max'), initialDetentOf)).toEqual({ kind: 'collapse', to: 'mid' });
  });

  it('pops a top sheet at its initial detent', () => {
    expect(decideBack(at('mid'), initialDetentOf)).toEqual({ kind: 'pop' });
  });

  it('pops a top sheet lowered below its initial detent', () => {
    expect(decideBack(at('min'), initialDetentOf)).toEqual({ kind: 'pop' });
  });

  it('goes home at a tab root', () => {
    expect(decideBack(EMPTY_TASK, initialDetentOf)).toEqual({ kind: 'home' });
  });

  it('pops a raised top sheet at once under a screen reader, where it opened, and still goes home at a root', () => {
    expect(decideBack(at('max'), initialDetentOf, true)).toEqual({ kind: 'pop' });
    expect(decideBack(EMPTY_TASK, initialDetentOf, true)).toEqual({ kind: 'home' });
  });

  it('pops a top sheet resting at either detent of a two-detent root that opens at its top', () => {
    // A sheet that inherits the transit root's detents (small, medium) and opens at medium can never
    // be above its opening, so back pops it from medium and from small alike.
    const opensAtTop = () => 'mid' as const;
    const resting = (detent: 'min' | 'mid') => run(push(LINE), { type: 'setDetent', detent });
    expect(decideBack(resting('mid'), opensAtTop)).toEqual({ kind: 'pop' });
    expect(decideBack(resting('min'), opensAtTop)).toEqual({ kind: 'pop' });
  });
});

describe("dismissAction: what a sheet's one close button does", () => {
  it('goes back to the sheet below when there is one, and closes a lone sheet', () => {
    expect(dismissAction(run(push(LINE), push(STOP)))).toBe('back');
    expect(dismissAction(run(push(LINE)))).toBe('close');
    expect(dismissAction(EMPTY_TASK)).toBe('close');
  });
});

describe('SHEET_KIND_HOME_TAB', () => {
  it.each([
    ['line', 'transit'],
    ['bus_stop', 'transit'],
    ['subway_station', 'transit'],
    ['skku_building', 'map'],
    ['event', 'map'],
    ['chip', 'map'],
  ] as const)('%s lives in the %s tab', (kind, tab) => {
    expect(SHEET_KIND_HOME_TAB[kind]).toBe(tab);
  });
});

describe('toMapSheetKey: what makes two of the map\'s own requests one sheet', () => {
  it.each([
    [BUILDING, { ...BUILDING, source: 'search' }],
    [BOOTH, { ...BOOTH, source: 'list', area: true }],
    [BAR_CHIP, { kind: 'chip', chipId: 'eskara26_view_bar' }],
  ] as const)('names %o and %o one sheet: the source and the opening are not part of it', (a, b) => {
    expect(toMapSheetKey(a)).toBe(toMapSheetKey(b));
  });

  it.each([
    [BUILDING, OTHER_BUILDING],
    [BUILDING, { ...BUILDING, highlightSpaceCd: '31101' }],
    [BAR_CHIP, STAGE_CHIP],
    [{ kind: 'event', placeId: '31', source: 'pin' }, { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'pin' }],
  ] as const)('tells %o from %o', (a, b) => {
    expect(toMapSheetKey(a)).not.toBe(toMapSheetKey(b));
  });
});

describe('sheetTabFor: a sheet asked for above the tabs opens in the map tab beneath', () => {
  it.each([
    ['bus_stop', 'map', 'map'],
    ['bus_stop', 'transit', 'transit'],
    ['skku_building', 'transit', 'transit'],
  ] as const)('a %s asked for over the %s tab opens there', (kind, beneath, tab) => {
    expect(sheetTabFor(kind, beneath)).toBe(tab);
  });

  it.each([
    ['bus_stop', 'transit'],
    ['skku_building', 'map'],
  ] as const)('a %s asked for over a tab with no map opens in its home tab, %s', (kind, tab) => {
    expect(sheetTabFor(kind, null)).toBe(tab);
  });
});

/**
 * A view table with the places another feature serves, as that feature would
 * supply them: it builds its own requests from the place it is given.
 */
const Nothing = () => null;
const FED_VIEWS: Partial<MapSheetViewTable> = {
  bus_stop: {
    presentation: 'over',
    View: Nothing,
    keyOf: () => 'stop',
    fromPlace: ({ placeId, source, line }: MapSheetPlace) => ({ kind: 'bus_stop', stopId: placeId, source, ...(line && { line }) }),
  },
  subway_station: {
    presentation: 'over',
    View: Nothing,
    keyOf: () => 'station',
    fromPlace: ({ placeId, source }: MapSheetPlace) => ({ kind: 'subway_station', stationId: placeId, source }),
  },
};

describe('toSheetRequest: a place link to the sheet it opens', () => {
  it.each([
    [
      { kind: null, placeId: 'eskara26-booth-3' },
      { kind: 'event', placeId: 'eskara26-booth-3', source: 'deeplink' },
    ],
    [
      { kind: 'event', placeId: 'eskara26-booth-3', source: 'miniapp' },
      { kind: 'event', placeId: 'eskara26-booth-3', source: 'miniapp' },
    ],
    [
      { kind: 'skku_building', placeId: '31' },
      { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'deeplink' },
    ],
    [
      { kind: 'skku_building', placeId: '31', source: 'place_sheet' },
      { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'place_sheet' },
    ],
    [
      { kind: 'skku_building', placeId: '31', highlightSpaceCd: '33B101', source: 'place_sheet' },
      { kind: 'skku_building', placeId: '31', highlightSpaceCd: '33B101', source: 'place_sheet' },
    ],
    [{ kind: 'bus_stop', placeId: '01-123' }, { kind: 'bus_stop', stopId: '01-123', source: 'deeplink' }],
    [
      { kind: 'bus_stop', placeId: '01-123', source: 'search' },
      { kind: 'bus_stop', stopId: '01-123', source: 'search' },
    ],
    [
      { kind: 'subway_station', placeId: '0150', source: 'miniapp' },
      { kind: 'subway_station', stationId: '0150', source: 'miniapp' },
    ],
  ] as const)('%o opens %o', (link, expected) => {
    expect(toSheetRequest(link, FED_VIEWS)).toEqual(expected);
  });

  it('drops a building reference whose id is not a number', () => {
    expect(toSheetRequest({ kind: 'skku_building', placeId: 'main-hall' }, FED_VIEWS)).toBeNull();
  });

  it('opens nothing for a kind another feature serves when the shell composed no view for it', () => {
    expect(toSheetRequest({ kind: 'bus_stop', placeId: '01-123' }, {})).toBeNull();
  });
});

describe('toPlaceRequest: an event place opened from a link or a list row', () => {
  const tap = { kind: 'event', placeId: 'eskara26-booth-3' } as const;

  it('opens the place by its tap id, with the source it was opened from', () => {
    // Arrange
    const place = { kind: 'marker', id: 'overlay-7', tap, locationAccuracy: 'exact' } as MapOverlay;

    // Act / Assert
    expect(toPlaceRequest(place, 'list')).toEqual({ kind: 'event', placeId: 'eskara26-booth-3', source: 'list', area: false });
  });

  it('opens at max a place whose pin names only an area', () => {
    // Arrange
    const place = { kind: 'marker', id: 'overlay-8', tap, locationAccuracy: 'area' } as MapOverlay;

    // Act / Assert
    expect(toPlaceRequest(place, 'deeplink')).toMatchObject({ area: true, source: 'deeplink' });
  });

  it('falls back to the overlay id for a place with no event tap', () => {
    // Arrange
    const place = { kind: 'polygon', id: 'eskara26-zone-1', tap: null } as MapOverlay;

    // Act / Assert
    expect(toPlaceRequest(place, 'list')).toMatchObject({ placeId: 'eskara26-zone-1' });
  });
});

describe('toSheetRequestFromTap: a marker tap to the sheet it opens', () => {
  const MARKER = { kind: 'marker' } as MapOverlay;
  const ZONE = { kind: 'polygon' } as MapOverlay;
  const placeOf = (id: string) => (id === 'eskara26-booth-3' ? MARKER : id === 'eskara26-zone-1' ? ZONE : undefined);

  it('opens a building from its pin', () => {
    expect(toSheetRequestFromTap({ kind: 'skku_building', placeId: '31' }, placeOf, FED_VIEWS)).toEqual(BUILDING);
  });

  it('opens no building for an id that is not a number', () => {
    expect(toSheetRequestFromTap({ kind: 'skku_building', placeId: 'main-hall' }, placeOf, FED_VIEWS)).toBeNull();
  });

  it('opens an event place from its pin or its zone, recording which', () => {
    expect(toSheetRequestFromTap({ kind: 'event', placeId: 'eskara26-booth-3' }, placeOf, FED_VIEWS)).toEqual({ ...BOOTH, area: false });
    expect(toSheetRequestFromTap({ kind: 'event', placeId: 'eskara26-zone-1' }, placeOf, FED_VIEWS)).toEqual({
      kind: 'event',
      placeId: 'eskara26-zone-1',
      source: 'zone',
      area: false,
    });
  });

  it('opens nothing for a place the overlays do not hold', () => {
    expect(toSheetRequestFromTap({ kind: 'event', placeId: 'gone' }, placeOf, FED_VIEWS)).toBeNull();
  });

  it('marks an event place whose pin names only an area, so its sheet opens at max', () => {
    const area = { kind: 'marker', locationAccuracy: 'area' } as MapOverlay;
    expect(toSheetRequestFromTap({ kind: 'event', placeId: 'eskara26-area-1' }, () => area, FED_VIEWS)).toMatchObject({ area: true });
  });

  it('opens a stop from a line’s own pin with that line, so the stop sheet steps along it', () => {
    const line = { groupId: 'jongro07', stationIndex: 16 };
    expect(toSheetRequestFromTap({ kind: 'bus_stop', placeId: '01-123', line }, placeOf, FED_VIEWS)).toEqual({
      kind: 'bus_stop',
      stopId: '01-123',
      source: 'pin',
      line,
    });
  });

  it('opens a stop from its pin', () => {
    expect(toSheetRequestFromTap({ kind: 'bus_stop', placeId: '01-123' }, placeOf, FED_VIEWS)).toEqual({
      kind: 'bus_stop',
      stopId: '01-123',
      source: 'pin',
    });
  });

  it('opens no stop when the shell composed no view for stops', () => {
    expect(toSheetRequestFromTap({ kind: 'bus_stop', placeId: '01-123' }, placeOf, {})).toBeNull();
  });

  it('opens no sheet for a chip tap, which runs the chip instead', () => {
    expect(toSheetRequestFromTap({ kind: 'chip', chipId: 'food_trucks' }, placeOf, FED_VIEWS)).toBeNull();
  });
});

describe('dismiss and topmostEntry', () => {
  it('dismiss removes one entry wherever it sits, and an unknown id changes nothing', () => {
    const task = run(push(BOOTH), push(BUILDING), push(LINE));
    const booth = task.stack[0]!;
    expect(kinds(reduceMapTask(task, { type: 'dismiss', id: booth.id }))).toEqual(['skku_building', 'line']);
    expect(reduceMapTask(task, { type: 'dismiss', id: 99 })).toBe(task);
  });

  it('topmostEntry finds the highest entry of a kind, under other sheets', () => {
    const task = run(push(BOOTH), push({ ...BOOTH, placeId: 'eskara26-booth-9' }), push(BUILDING));
    expect(topmostEntry(task, 'event')?.request).toEqual({ ...BOOTH, placeId: 'eskara26-booth-9' });
    expect(topmostEntry(task, 'line')).toBeNull();
  });
});

describe('cameraOnReveal: a sheet keeps its own camera (ADR 0022 rule 2)', () => {
  const remember = (camera: MapCameraSnapshot): MapTaskAction => ({ type: 'rememberCamera', camera });

  it('restores the camera of the sheet a pop reveals', () => {
    // Arrange
    const before = run(push(LINE), remember(CAMERA_A), push(STOP), remember(CAMERA_B));
    const { seen } = cameraOnReveal(null, 'transit', before);

    // Act
    const reveal = cameraOnReveal(seen, 'transit', reduceMapTask(before, { type: 'pop' }));

    // Assert
    expect(reveal.restore).toEqual(CAMERA_A);
  });

  it('restores nothing for a sheet just pushed, which has framed nothing yet', () => {
    // Arrange
    const before = run(push(LINE), remember(CAMERA_A));
    const { seen } = cameraOnReveal(null, 'transit', before);

    // Act
    const reveal = cameraOnReveal(seen, 'transit', reduceMapTask(before, push(STOP)));

    // Assert
    expect(reveal.restore).toBeNull();
  });

  it('restores nothing while the same sheet stays on top and records a new camera', () => {
    // Arrange
    const before = run(push(LINE), remember(CAMERA_A));
    const { seen } = cameraOnReveal(null, 'transit', before);

    // Act
    const reveal = cameraOnReveal(seen, 'transit', reduceMapTask(before, remember(CAMERA_B)));

    // Assert
    expect(reveal).toEqual({ seen, restore: null });
  });

  it('restores nothing on a tab switch, which leaves the map where it is, and records the new top', () => {
    // Arrange
    const mapTask = run(push(BUILDING), remember(CAMERA_B));
    const { seen } = cameraOnReveal(null, 'transit', EMPTY_TASK);

    // Act
    const reveal = cameraOnReveal(seen, 'map', mapTask);

    // Assert
    expect(reveal.restore).toBeNull();
    expect(cameraOnReveal(reveal.seen, 'map', mapTask).restore).toBeNull();
  });

  it('restores the camera of a pop made after a tab switch, so the switch costs the next reveal nothing', () => {
    // Arrange
    const before = run(push(LINE), remember(CAMERA_A), push(STOP), remember(CAMERA_B));
    const { seen } = cameraOnReveal(cameraOnReveal(null, 'map', EMPTY_TASK).seen, 'transit', before);

    // Act
    const reveal = cameraOnReveal(seen, 'transit', reduceMapTask(before, { type: 'pop' }));

    // Assert
    expect(reveal.restore).toEqual(CAMERA_A);
  });

  it('keeps the shared camera on a return to a tab at its root', () => {
    // Arrange
    const { seen } = cameraOnReveal(null, 'map', run(push(BUILDING), remember(CAMERA_B)));

    // Act
    const reveal = cameraOnReveal(seen, 'transit', EMPTY_TASK);

    // Assert
    expect(reveal.restore).toBeNull();
  });

  it('keeps the shared camera when a pop empties the stack', () => {
    // Arrange
    const before = run(push(LINE), remember(CAMERA_A));
    const { seen } = cameraOnReveal(null, 'transit', before);

    // Act
    const reveal = cameraOnReveal(seen, 'transit', reduceMapTask(before, { type: 'pop' }));

    // Assert
    expect(reveal.restore).toBeNull();
  });
});

describe('fedKindOf: which place kinds another feature feeds', () => {
  it.each([
    [null, null],
    ['event', null],
    ['skku_building', null],
    ['bus_stop', 'bus_stop'],
    ['subway_station', 'subway_station'],
  ] as const)('%s is %s', (kind, fed) => {
    expect(fedKindOf(kind)).toBe(fed);
  });
});

describe('fedPlaceLayers', () => {
  const STOP: MapPlace = {
    id: 'seoul-01592',
    name: { ko: '혜화역', en: '혜화역' },
    coords: null,
    layers: { jongro07_route: true },
  };

  it('opens a fed place with its own layers once its feed has answered', () => {
    // Act / Assert
    expect(fedPlaceLayers(new Map([[STOP.id, STOP]]), 'seoul-01592')).toStrictEqual({ jongro07_route: true });
  });

  it('opens a place its feed does not list with no layers', () => {
    // Act / Assert
    expect(fedPlaceLayers(new Map([[STOP.id, STOP]]), 'hssc-bus-lot')).toStrictEqual({});
  });

  it('says to wait while the feed has not answered', () => {
    // Act / Assert
    expect(fedPlaceLayers(undefined, 'seoul-01592')).toBeNull();
  });
});
