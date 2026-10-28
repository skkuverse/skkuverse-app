/**
 * A place a page opened, through the map's door (ADR 0022 d7, amended
 * 2026-10-27): it opens on the tab beneath the page, and the user's close of
 * it pushes the page back after the stack has changed. Runs the real service
 * against the real store; only the router, analytics, the settings store and
 * the web service are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import { markTabSwitch } from '@/platform/analytics';
import { EMPTY_TASK, reduceMapTask, topEntry } from './map-task.rules';
import { backOnMapTab, closeSheet, followFocusedRoute, openMapAtPlace, popMapTaskToRoot } from './map.service';
import { mapPlaceLinkQueue, useMapStore } from './map.store';
import type { MapSheetRequest, MapTaskState, PageOrigin } from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';

const settings = vi.hoisted(() => ({ lastTab: 'transit' as string }));

vi.mock('expo-router', () => ({ router: { navigate: vi.fn(), dismissTo: vi.fn(), push: vi.fn() } }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn(), markTabSwitch: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('@/features/web/web.service', () => ({ handleSduiAction: vi.fn(), openWebView: vi.fn() }));
vi.mock('@skkuverse/shared', () => ({
  useSettingsStore: { getState: () => ({ lastTab: settings.lastTab, preferredCampus: 'hssc' }) },
  createPendingSlot: <T,>() => {
    let value: T | null = null;
    return {
      set: (next: T) => void (value = next),
      consume: (match: (v: T) => boolean) => {
        const taken = value !== null && match(value) ? value : null;
        if (taken) value = null;
        return taken;
      },
      subscribe: () => () => {},
    };
  },
}));

const ROUTE: PageOrigin = { href: '/routes/[routeId]', params: { routeId: 'hssc-to-nsc', source: 'return' } };
const STATION: MapSheetRequest = { kind: 'subway_station', stationId: '0150', source: 'route_detail' };
const LINE: MapSheetRequest = { kind: 'line', groupId: 'hssc', source: 'tab' };

const View = () => null;
const keyOf = (request: MapSheetRequest) => JSON.stringify(request);
const VIEWS: Partial<MapSheetViewTable> = {
  subway_station: { presentation: 'swap', View, profile: 'stop', label: 'map.sheet.a11y.list', keyOf },
  line: { presentation: 'swap', View, profile: 'route', label: 'map.sheet.a11y.list', keyOf },
};

function opened(state: MapTaskState, request: MapSheetRequest, origin?: PageOrigin): MapTaskState {
  return reduceMapTask(state, { type: 'push', request, key: keyOf(request), layers: {}, detent: 'max', ...(origin && { origin }) });
}

/** The stack at the moment the page was pushed back. */
let stackAtPush: readonly unknown[] | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  settings.lastTab = 'transit';
  stackAtPush = null;
  vi.mocked(router.push).mockImplementation(() => {
    stackAtPush = useMapStore.getState().tasks.transit.stack;
  });
  useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: opened(opened(EMPTY_TASK, LINE), STATION, ROUTE) } });
});

describe('closeSheet', () => {
  it('pops the sheet a page opened, then pushes the page back', () => {
    closeSheet('transit', { kind: 'close' });

    expect(router.push).toHaveBeenCalledWith({ pathname: '/routes/[routeId]', params: ROUTE.params });
    expect(stackAtPush).toStrictEqual(useMapStore.getState().tasks.transit.stack);
    expect(topEntry(useMapStore.getState().tasks.transit)?.request).toBe(LINE);
  });

  it('pushes nothing for a close the app makes', () => {
    closeSheet('transit', { kind: 'retap' });

    expect(useMapStore.getState().tasks.transit.stack).toStrictEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('pushes nothing for a sheet opened on the map', () => {
    closeSheet('transit', { kind: 'close' });
    vi.mocked(router.push).mockClear();

    closeSheet('transit', { kind: 'close' });

    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('the back key and the re-tap', () => {
  it('back on a raised sheet a page opened returns to the page at once', () => {
    expect(backOnMapTab('transit', VIEWS, false)).toBe('handled');

    expect(topEntry(useMapStore.getState().tasks.transit)?.request).toBe(LINE);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('a re-tap drops the stack and stays on the tab', () => {
    expect(popMapTaskToRoot('transit')).toBe(true);

    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('openMapAtPlace with a page origin', () => {
  it('opens on the tab beneath the page, with the origin, and marks no tab switch when the tab stays', () => {
    openMapAtPlace({ kind: 'subway_station', placeId: '0150' }, 'route_detail', ROUTE);

    expect(mapPlaceLinkQueue.consume('transit')).toMatchObject({ placeId: '0150', origin: ROUTE, tab: 'transit' });
    expect(markTabSwitch).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/transit');
  });

  it('marks the page a return, whatever source it was opened with', () => {
    openMapAtPlace({ kind: 'subway_station', placeId: '0150' }, 'schedule_boarding', {
      href: '/bus/schedule',
      params: { groupId: 'campus', source: 'tab' },
    });

    expect(mapPlaceLinkQueue.consume('transit')?.origin).toStrictEqual({
      href: '/bus/schedule',
      params: { groupId: 'campus', source: 'return' },
    });
  });

  it("opens a station on the map tab when the map tab is beneath, not in the station's home tab", () => {
    settings.lastTab = 'campus';

    openMapAtPlace({ kind: 'subway_station', placeId: '0150' }, 'route_detail', ROUTE);

    expect(mapPlaceLinkQueue.consume('map')).toMatchObject({ origin: ROUTE, tab: 'map' });
  });

  it("still opens a place with no origin in its home tab, as before", () => {
    settings.lastTab = 'campus';

    openMapAtPlace({ kind: 'subway_station', placeId: '0150' }, 'sdui');

    expect(mapPlaceLinkQueue.consume('transit')).not.toHaveProperty('origin');
    expect(markTabSwitch).toHaveBeenCalledWith('transit', 'sheet');
  });
});

describe('followFocusedRoute: an origin lasts only while its tab stays in front', () => {
  const STATION_ON_MAP = () => useMapStore.getState().tasks.map.stack.at(-1);

  beforeEach(() => {
    useMapStore.setState({ tasks: { map: opened(EMPTY_TASK, STATION, ROUTE), transit: opened(EMPTY_TASK, LINE) } });
  });

  it.each(['home', 'notices', 'transit'] as const)('forgets it when %s comes in front, and the close stays on the map', (next) => {
    followFocusedRoute('campus', next);
    followFocusedRoute(next, 'campus');

    expect(STATION_ON_MAP()).not.toHaveProperty('origin');
    closeSheet('map', { kind: 'close' });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('forgets it when a page is pushed over the tabs: the route page opened again from its chip, then back', () => {
    followFocusedRoute('campus', null);
    followFocusedRoute(null, 'campus');

    closeSheet('map', { kind: 'close' });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('forgets it before a search result swaps another building in, so the swap returns nowhere', () => {
    const BUILDING: MapSheetRequest = { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'route_detail' };
    const OTHER: MapSheetRequest = { kind: 'skku_building', placeId: '2', highlightSpaceCd: null, source: 'search' };
    useMapStore.setState({ tasks: { map: opened(EMPTY_TASK, BUILDING, ROUTE), transit: EMPTY_TASK } });

    followFocusedRoute('campus', null); // the search screen
    useMapStore.getState().dispatchTask('map', { type: 'select', request: OTHER, key: keyOf(OTHER), layers: {}, detent: 'max' });
    followFocusedRoute(null, 'campus');

    expect(STATION_ON_MAP()?.request).toBe(OTHER);
    expect(STATION_ON_MAP()).not.toHaveProperty('origin');
  });

  it('keeps it when the tabs come in front from the page that opened the place', () => {
    followFocusedRoute(null, 'campus');

    expect(STATION_ON_MAP()?.origin).toEqual(ROUTE);
  });

  it('keeps it across a render that names the same tab again', () => {
    followFocusedRoute('campus', 'campus');

    expect(STATION_ON_MAP()?.origin).toEqual(ROUTE);
  });
});
