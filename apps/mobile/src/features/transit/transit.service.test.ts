/**
 * Opening a line or a station on the transit tab from a route above the tabs
 * (ADR 0022 d7): the request is left for the tab and the tab replaces the
 * route. The service never reads the shell, which the test shows under both:
 * only the route files decide whether a redirect runs at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openPlaceAsScreen, openTransitLine, openTransitStation, pendingTransitSheet } from './transit.service';

const navigation = vi.hoisted(() => ({ dismissTo: vi.fn(), push: vi.fn(), markTabSwitch: vi.fn(), openMapAtPlace: vi.fn() }));
vi.mock('expo-router', () => ({ router: { dismissTo: navigation.dismissTo, push: navigation.push } }));
vi.mock('@/platform/analytics', () => ({ markTabSwitch: navigation.markTabSwitch }));
vi.mock('@/features/map/map.service', () => ({ openMapAtPlace: navigation.openMapAtPlace }));

beforeEach(() => {
  navigation.dismissTo.mockClear();
  navigation.push.mockClear();
  navigation.markTabSwitch.mockClear();
  navigation.openMapAtPlace.mockClear();
  pendingTransitSheet.consume();
});

describe.each(['native-tabs', 'shared-map'] as const)('opening a transit sheet under the %s shell', (shell) => {
  beforeEach(() => {
    vi.doMock('@/bootstrap/shell.service', () => ({ SHELL: shell }));
  });

  it('leaves a line for the transit tab and lands on it', () => {
    // Act
    openTransitLine('jongro07', 'tab');

    // Assert
    expect(pendingTransitSheet.consume()).toStrictEqual({ kind: 'line', groupId: 'jongro07', source: 'tab' });
    expect(navigation.markTabSwitch).toHaveBeenCalledWith('transit', 'sheet');
    expect(navigation.dismissTo).toHaveBeenCalledWith('/(tabs)/transit');
  });

  it('leaves a station, on the line the route named, and lands on the tab', () => {
    // Act
    openTransitStation('jeongja', 'D1', 'sdui');

    // Assert
    expect(pendingTransitSheet.consume()).toStrictEqual({ kind: 'subway_station', stationId: 'jeongja', line: 'D1', source: 'sdui' });
    expect(navigation.dismissTo).toHaveBeenCalledWith('/(tabs)/transit');
  });

  it('carries no line, and the source other, when the route named neither', () => {
    // Act
    openTransitLine('hssc');
    const line = pendingTransitSheet.consume();
    openTransitStation('hyehwa');

    // Assert
    expect(line).toStrictEqual({ kind: 'line', groupId: 'hssc', source: 'other' });
    expect(pendingTransitSheet.consume()).toStrictEqual({ kind: 'subway_station', stationId: 'hyehwa', source: 'other' });
  });
});

describe('openPlaceAsScreen: a place a page opens under the native tabs', () => {
  const ROUTE = { href: '/routes/[routeId]', params: { routeId: 'a', source: 'return' } };

  it('pushes a station as its own screen over the page, so back returns to the page', () => {
    // Act
    openPlaceAsScreen({ kind: 'subway_station', placeId: '0150' }, 'schedule_boarding', ROUTE);

    // Assert
    expect(navigation.push).toHaveBeenCalledWith('/subway?station=0150&source=schedule_boarding');
    expect(navigation.openMapAtPlace).not.toHaveBeenCalled();
  });

  it('opens anything else, and a station no page asked for, on the map as before', () => {
    // Act
    openPlaceAsScreen({ kind: 'skku_building', placeId: '31' }, 'route_detail', ROUTE);
    openPlaceAsScreen({ kind: 'subway_station', placeId: '0150' }, 'sdui');

    // Assert
    expect(navigation.openMapAtPlace).toHaveBeenNthCalledWith(1, { kind: 'skku_building', placeId: '31' }, 'route_detail');
    expect(navigation.openMapAtPlace).toHaveBeenNthCalledWith(2, { kind: 'subway_station', placeId: '0150' }, 'sdui');
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
