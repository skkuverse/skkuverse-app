/**
 * The map's door for the shell (ADR 0023 d3) and for every opener of a sheet:
 * the Android back key and a re-tap on a map tab, and opening a sheet at the
 * detent its view opens at. Runs the real service against the real store;
 * only the router, analytics and the web service are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_TASK, reduceMapTask, topEntry } from './map-task.rules';
import { backOnMapTab, openSheet, popMapTaskToRoot } from './map.service';
import { useMapStore } from './map.store';
import type { MapDetent } from './sheet-detents.constants';
import type { MapSheetRequest, MapTaskState } from './sheet-stack.types';
import type { MapSheetViewTable } from './sheet-views.types';

vi.mock('expo-router', () => ({ router: { navigate: vi.fn(), dismissTo: vi.fn() } }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn(), markTabSwitch: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('@/features/web/web.service', () => ({ handleSduiAction: vi.fn(), openWebView: vi.fn() }));

const BUILDING: MapSheetRequest = { kind: 'skku_building', placeId: '31', highlightSpaceCd: null, source: 'pin' };
const BOOTH: MapSheetRequest = { kind: 'event', placeId: 'eskara26-booth-3', source: 'pin' };

const View = () => null;
/** An opaque key per distinct request, as each kind's owner would name one. */
const keyOf = (request: MapSheetRequest) => JSON.stringify(request);
/** A building opens at `max` (the place profile), a booth at `min` (peek); nothing else has a view. */
const VIEWS: Partial<MapSheetViewTable> = {
  skku_building: { presentation: 'swap', View, profile: 'place', label: 'map.sheet.a11y.list', keyOf },
  event: { presentation: 'swap', View, profile: 'peek', label: 'map.sheet.a11y.list', keyOf },
};

function opened(request: MapSheetRequest, detent: MapDetent): MapTaskState {
  return reduceMapTask(EMPTY_TASK, { type: 'push', request, key: keyOf(request), layers: {}, detent });
}

beforeEach(() => {
  useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: EMPTY_TASK } });
});

describe('openSheet', () => {
  it("records the detent the request's view opens at", () => {
    // Act
    openSheet('map', 'push', BOOTH, {}, VIEWS);

    // Assert
    expect(topEntry(useMapStore.getState().tasks.map)).toMatchObject({ request: BOOTH, detent: 'min' });
  });

  it('opens nothing for a kind the shell composed no view for', () => {
    // Act
    openSheet('transit', 'select', { kind: 'line', groupId: 'hssc', source: 'tab' }, {}, VIEWS);

    // Assert
    expect(useMapStore.getState().tasks.transit).toBe(EMPTY_TASK);
  });
});

describe('backOnMapTab', () => {
  it('collapses a sheet dragged above its opening detent before popping it', () => {
    // Arrange
    useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: opened(BOOTH, 'max') } });

    // Act
    const result = backOnMapTab('transit', VIEWS, false);

    // Assert
    expect(result).toBe('handled');
    expect(topEntry(useMapStore.getState().tasks.transit)?.detent).toBe('min');
  });

  it('pops a sheet resting at the top detent at once under a screen reader, where it opened', () => {
    // Arrange
    useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: opened(BOOTH, 'max') } });

    // Act
    const result = backOnMapTab('transit', VIEWS, true);

    // Assert
    expect(result).toBe('handled');
    expect(topEntry(useMapStore.getState().tasks.transit)).toBeNull();
  });

  it('pops a sheet resting at its opening detent', () => {
    // Arrange
    useMapStore.setState({ tasks: { map: opened(BUILDING, 'max'), transit: EMPTY_TASK } });

    // Act
    const result = backOnMapTab('map', VIEWS, false);

    // Assert
    expect(result).toBe('handled');
    expect(topEntry(useMapStore.getState().tasks.map)).toBeNull();
  });

  it("says home at a map tab's root, reading only that tab", () => {
    // Arrange
    useMapStore.setState({ tasks: { map: opened(BUILDING, 'max'), transit: EMPTY_TASK } });

    // Act
    const result = backOnMapTab('transit', VIEWS, false);

    // Assert
    expect(result).toBe('home');
    expect(topEntry(useMapStore.getState().tasks.map)?.request).toBe(BUILDING);
  });
});

describe('popMapTaskToRoot', () => {
  it('drops the tab to its root sheet when a sheet is open', () => {
    // Arrange
    const transit = opened(BOOTH, 'min');
    useMapStore.setState({ tasks: { map: opened(BUILDING, 'max'), transit } });

    // Act
    const popped = popMapTaskToRoot('map');

    // Assert
    expect(popped).toBe(true);
    expect(useMapStore.getState().tasks.map.stack).toStrictEqual([]);
    expect(useMapStore.getState().tasks.transit).toBe(transit);
  });

  it('does nothing at the root, so the shell scrolls to top instead', () => {
    // Arrange
    useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: opened(BOOTH, 'min') } });

    // Act
    const popped = popMapTaskToRoot('map');

    // Assert
    expect(popped).toBe(false);
    expect(useMapStore.getState().tasks.map).toBe(EMPTY_TASK);
  });
});
