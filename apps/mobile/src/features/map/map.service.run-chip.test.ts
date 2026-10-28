/**
 * A chip whose result is on the map runs in the map tab only (ADR 0022 d1,
 * owner 2026-10-24). Tapped on the transit tab's row it writes the map
 * tab's task before the tab switches, so the map tab opens on the chip rather
 * than restoring the camera of whatever was on top of it, and the transit tab
 * keeps its task. Runs the real `runChip` against the real store; only the
 * router, analytics and the web openers are doubles.
 */
import { router } from 'expo-router';
import { markTabSwitch, track } from '@/platform/analytics';
import { handleSduiAction } from '@/features/web/web.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_TASK, activeChip, reduceMapTask } from './map-task.rules';
import { runChip, type ChipRunHost } from './map.service';
import { useMapStore } from './map.store';
import type { MapChip, MapChipCamera, MapLayerDef } from './map-config.types';
import type { MapTaskState } from './sheet-stack.types';

vi.mock('expo-router', () => ({ router: { navigate: vi.fn(), dismissTo: vi.fn() } }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn(), markTabSwitch: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('@/features/web/web.service', () => ({ handleSduiAction: vi.fn(), openWebView: vi.fn() }));

const ROUTE: MapLayerDef = {
  id: 'hssc_route',
  label: 'hssc_route',
  defaultVisibleWhen: { kind: 'never' },
  endpoint: '/map/overlays/transit',
  chipGroupId: null,
  userConfigurable: true,
  tabs: ['transit'],
};

const STAGE: MapLayerDef = { ...ROUTE, id: 'eskara26_stage', endpoint: '/map/overlays/event', chipGroupId: 'eskara-2026', tabs: undefined };

const CAMERA: MapChipCamera = { lat: 37.587, lng: 126.994, zoom: 15, tilt: 0, bearing: 0, durationMs: 0 };

/** A `layers` chip on both rows, run in the map tab. Synthetic: no base chip is one today, but the wire allows it. */
const ROUTE_LINES: MapChip = {
  id: 'route_lines',
  label: 'route_lines',
  icon: null,
  action: { kind: 'layers', layerIds: ['hssc_route'], camera: CAMERA },
  isReset: false,
  list: null,
  tabs: ['map', 'transit'],
  opensIn: 'map',
};

const FESTIVAL: MapChip = { ...ROUTE_LINES, id: 'eskara26_view_stage', action: { kind: 'focus', layerIds: ['eskara26_stage'], camera: CAMERA } };

/** A stop the user had open on the transit tab. */
const TRANSIT_TASK = reduceMapTask(EMPTY_TASK, {
  type: 'push',
  request: { kind: 'bus_stop', stopId: 'hssc_main', source: 'pin' },
  key: 'bus_stop:hssc_main',
  layers: {},
  detent: 'mid',
});

/** The map tab's task as it stood when the router was asked to switch to it. */
let mapAtNavigate: MapTaskState | null = null;

const host = (over: Partial<ChipRunHost> = {}): ChipRunHost => ({
  scope: 'byTab',
  layers: [ROUTE, STAGE],
  moveTo: vi.fn(),
  lowerToReveal: vi.fn(),
  ...over,
});

beforeEach(() => {
  useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: TRANSIT_TASK } });
  mapAtNavigate = null;
  vi.mocked(router.navigate).mockReset();
  vi.mocked(track).mockReset();
  vi.mocked(markTabSwitch).mockReset();
  vi.mocked(handleSduiAction).mockReset();
  vi.mocked(router.navigate).mockImplementation(() => {
    mapAtNavigate = useMapStore.getState().tasks.map;
  });
});

describe('runChip from the transit row', () => {
  it('has the chip on the map tab by the time the tab switches, and keeps the transit task', () => {
    // Arrange
    const run = host();

    // Act
    runChip(ROUTE_LINES, 'transit', 'row', run);

    // Assert
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/campus');
    expect(mapAtNavigate && activeChip(mapAtNavigate)?.request).toEqual({ kind: 'chip', chipId: 'route_lines' });
    expect(run.moveTo).toHaveBeenCalledWith(CAMERA, { request: 'chip' });
    expect(useMapStore.getState().tasks.transit).toBe(TRANSIT_TASK);
  });

  it('logs the tab it was tapped in and the map tab it ran in, and marks the switch as the chip\'s', () => {
    // Act
    runChip(ROUTE_LINES, 'transit', 'row', host());

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', {
      chip_id: 'route_lines',
      source: 'row',
      op: 'select',
      tab: 'transit',
      ran_in: 'map',
    });
    expect(markTabSwitch).toHaveBeenCalledWith('campus', 'chip');
  });

  it("opens the map tab's sheet lowered, so the result on the map shows, with no second snap from the host", () => {
    // Arrange
    const run = host();

    // Act
    runChip(ROUTE_LINES, 'transit', 'row', run);

    // Assert
    expect(useMapStore.getState().tasks.map.stack.at(-1)?.detent).toBe('min');
    expect(run.lowerToReveal).not.toHaveBeenCalled();
  });
});

describe('runChip in the map tab', () => {
  it('switches no tab and logs that it ran where it was tapped', () => {
    // Act
    runChip(ROUTE_LINES, 'map', 'row', host());

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', expect.objectContaining({ tab: 'map', ran_in: 'map' }));
    expect(router.navigate).not.toHaveBeenCalled();
    expect(markTabSwitch).not.toHaveBeenCalled();
  });

  it('opens the sheet lowered for a chip whose result is the map alone, with no second snap from the host', () => {
    // Arrange
    const run = host();

    // Act
    runChip(ROUTE_LINES, 'map', 'row', run);

    // Assert
    expect(useMapStore.getState().tasks.map.stack.at(-1)?.detent).toBe('min');
    expect(run.lowerToReveal).not.toHaveBeenCalled();
  });

  it('leaves the sheet to the event list for a chip that lists places', () => {
    // Arrange
    const run = host();

    // Act
    runChip(FESTIVAL, 'map', 'row', run);

    // Assert
    expect(run.lowerToReveal).not.toHaveBeenCalled();
  });
});

describe('runChip elsewhere', () => {
  it('opens a link chip tapped on the transit tab where it is, with no tab switch and no task', () => {
    // Arrange: the building map chip as GET /map/config serves it on both rows.
    const buildingMap: MapChip = {
      id: 'building_map',
      label: '건물지도',
      icon: { kind: 'emoji', emoji: '🏢' },
      action: { kind: 'link', actionType: 'route', actionValue: '/map/hssc' },
      isReset: false,
      list: null,
      tabs: ['map', 'transit'],
    };
    const run = host();

    // Act
    runChip(buildingMap, 'transit', 'row', run);

    // Assert
    expect(handleSduiAction).toHaveBeenCalledWith({
      actionType: 'route',
      actionValue: '/map/hssc',
      webviewTitle: '건물지도',
      source: 'chip',
    });
    expect(useMapStore.getState().tasks).toEqual({ map: EMPTY_TASK, transit: TRANSIT_TASK });
    expect(markTabSwitch).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(run.moveTo).not.toHaveBeenCalled();
    expect(run.lowerToReveal).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('map_chip', { chip_id: 'building_map', source: 'row', op: 'select', tab: 'transit' });
  });

  it('logs no tab it ran in for a chip that opens a page', () => {
    // Act
    runChip({ ...ROUTE_LINES, action: { kind: 'webview', url: 'https://webview.skkuverse.com/x' } }, 'transit', 'row', host());

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', { chip_id: 'route_lines', source: 'row', op: 'select', tab: 'transit' });
  });

  it('runs nothing yet for a transit list filter, and logs where it would run', () => {
    // Arrange
    const run = host();

    // Act
    runChip({ ...ROUTE_LINES, opensIn: 'transit' }, 'transit', 'row', run);

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', expect.objectContaining({ tab: 'transit', ran_in: 'transit' }));
    expect(useMapStore.getState().tasks).toEqual({ map: EMPTY_TASK, transit: TRANSIT_TASK });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(run.moveTo).not.toHaveBeenCalled();
  });

  it('sends map_chip and keeps the sheet as they always were on the native-tab shell, which has one map tab', () => {
    // Arrange
    const run = host({ scope: 'all' });

    // Act
    runChip(ROUTE_LINES, 'map', 'row', run);

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', { chip_id: 'route_lines', source: 'row', op: 'select' });
    expect(run.lowerToReveal).not.toHaveBeenCalled();
  });
});
