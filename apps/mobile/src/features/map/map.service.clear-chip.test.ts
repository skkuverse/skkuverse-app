/**
 * A chip is only ever on in the map tab (ADR 0022 d1, owner 2026-10-24), so
 * clearing it from its strip releases it there, and its `map_chip` names the
 * map tab where the shell scopes chips by tab, as a select does. Runs the
 * real `clearChip` against the real store; only analytics and the router are
 * doubles.
 */
import { track } from '@/platform/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_TASK, activeChip, reduceMapTask } from './map-task.rules';
import { clearChip } from './map.service';
import { useMapStore } from './map.store';

vi.mock('expo-router', () => ({ router: { navigate: vi.fn(), dismissTo: vi.fn() } }));
vi.mock('@/platform/analytics', () => ({ track: vi.fn(), markTabSwitch: vi.fn() }));
vi.mock('@/platform/ota', () => ({ isPrereleaseBuild: () => false }));
vi.mock('@/features/web/web.service', () => ({ handleSduiAction: vi.fn(), openWebView: vi.fn() }));

const CHIP_ON = reduceMapTask(EMPTY_TASK, {
  type: 'push',
  request: { kind: 'chip', chipId: 'route_lines' },
  key: 'chip:route_lines',
  layers: { hssc_route: true },
  detent: 'mid',
});

const STOP_OPEN = reduceMapTask(EMPTY_TASK, {
  type: 'push',
  request: { kind: 'bus_stop', stopId: 'hssc_main', source: 'pin' },
  key: 'bus_stop:hssc_main',
  layers: {},
  detent: 'mid',
});

beforeEach(() => {
  useMapStore.setState({ tasks: { map: CHIP_ON, transit: STOP_OPEN } });
  vi.mocked(track).mockReset();
});

describe('clearChip', () => {
  it('releases the chip on the map tab and leaves the transit task alone', () => {
    // Act
    clearChip('byTab');

    // Assert
    expect(activeChip(useMapStore.getState().tasks.map)).toBeNull();
    expect(useMapStore.getState().tasks.transit).toBe(STOP_OPEN);
  });

  it('names the map tab where chips are scoped by tab', () => {
    // Act
    clearChip('byTab');

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', {
      chip_id: 'route_lines',
      source: 'row',
      op: 'clear',
      tab: 'map',
    });
  });

  it('logs the clear as it always has where the shell ignores tabs', () => {
    // Act
    clearChip('all');

    // Assert
    expect(track).toHaveBeenCalledWith('map_chip', { chip_id: 'route_lines', source: 'row', op: 'clear' });
  });

  it('logs nothing with no chip on', () => {
    // Arrange
    useMapStore.setState({ tasks: { map: EMPTY_TASK, transit: STOP_OPEN } });

    // Act
    clearChip('byTab');

    // Assert
    expect(track).not.toHaveBeenCalled();
  });
});
