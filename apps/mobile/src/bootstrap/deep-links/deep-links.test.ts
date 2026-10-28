/**
 * Pins where every incoming link lands, cold and warm, and what it leaves for
 * the post-mount consumers. Only the analytics sink and the three pending
 * queues are doubles; the path parsing and the settings store are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@skkuverse/shared';
import { redirectSystemPath } from './deep-links.service';
import { redirectSystemPath as routeRedirect } from '../../../app/+native-intent';

const pending = vi.hoisted(() => ({
  notice: vi.fn(),
  miniApp: vi.fn(),
  mapPlace: vi.fn(),
  mapChip: vi.fn(),
  transitLine: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/features/notices/notices.service', () => ({
  pendingExternalNoticeLink: { set: pending.notice },
}));
vi.mock('@/features/web/web.service', () => ({ pendingMiniAppLink: { set: pending.miniApp } }));
vi.mock('@/features/map/map.service', () => ({
  pendingMapPlaceLink: { set: pending.mapPlace },
  pendingMapChipLink: { set: pending.mapChip },
}));
vi.mock('@/features/transit/transit.service', () => ({ pendingTransitSheet: { set: pending.transitLine } }));
vi.mock('@/platform/analytics', () => ({ track: pending.track }));

beforeEach(() => {
  for (const fn of Object.values(pending)) fn.mockClear();
  useSettingsStore.setState({ lastTab: 'transit' });
});

const warm = (path: string) => redirectSystemPath({ path, initial: false });
const cold = (path: string) => redirectSystemPath({ path, initial: true });

describe('redirectSystemPath', () => {
  it.each([
    ['/home', '/(tabs)/home'],
    ['/campus', '/(tabs)/campus'],
    ['/transit', '/(tabs)/transit'],
    ['/map/hssc', '/map/hssc'],
    ['/search', '/search'],
  ])('routes the allowed path %s to %s, cold and warm', (path, expected) => {
    // Act / Assert
    expect(warm(path)).toBe(expected);
    expect(cold(path)).toBe(expected);
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'static',
      via: 'deeplink',
      item_id: path,
      src: undefined,
    });
  });

  it.each(['/webview', '/bus/realtime', '/bus/schedule', '/login', '/onboarding', '/sds-states', '/this-week', '/nowhere'])(
    'sends the blocked path %s home',
    (path) => {
      // Act / Assert
      expect(warm(path)).toBe('/(tabs)/home');
      expect(cold(path)).toBe('/(tabs)/home');
      expect(pending.track).toHaveBeenLastCalledWith('link_open', {
        kind: 'blocked',
        via: 'deeplink',
        item_id: path,
        src: undefined,
      });
    },
  );

  it('restores the last tab on a cold bare /, and goes home on a warm one', () => {
    // Act / Assert
    expect(cold('/')).toBe('/(tabs)/transit');
    expect(warm('/')).toBe('/(tabs)/home');
    expect(pending.track).not.toHaveBeenCalled();
  });

  it('falls back to home on a cold bare / whose last tab is unreadable', () => {
    // Arrange
    useSettingsStore.setState({ lastTab: 'gone' as never });

    // Act / Assert
    expect(cold('/')).toBe('/(tabs)/home');
  });

  it('intercepts a notice and leaves it for the notices consumer', () => {
    // Act
    const route = warm('/notices/cse-dept/5847');

    // Assert
    expect(route).toBe('/(tabs)/notices');
    expect(pending.notice).toHaveBeenCalledWith({
      sourceId: 'cse-dept',
      articleNo: '5847',
      source: 'universal_link',
    });
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'notice',
      via: 'deeplink',
      item_id: 'cse-dept/5847',
      src: undefined,
    });
  });

  it.each(['/notices/cse/5847/extra', '/notices/CSE/5847', '/notices/cse/abc'])(
    'does not intercept the malformed notice path %s',
    (path) => {
      // Act / Assert
      expect(warm(path)).toBe('/(tabs)/home');
      expect(pending.notice).not.toHaveBeenCalled();
    },
  );

  it('strips the shared-link prefix, from a full cold URL and a warm pathname alike', () => {
    // Act / Assert
    expect(cold('skkuverse:///p/notices/cse/1')).toBe('/(tabs)/notices');
    expect(warm('/p/notices/cse/1')).toBe('/(tabs)/notices');
    expect(pending.notice).toHaveBeenCalledTimes(2);
  });

  it('intercepts a mini app by shape and leaves its target for the consumer', () => {
    // Act
    const route = warm('/m/hssc/floor/3');

    // Assert
    expect(route).toBe('/(tabs)/home');
    expect(pending.miniApp).toHaveBeenCalledTimes(1);
    expect(pending.miniApp.mock.calls[0]?.[0]).toMatchObject({ id: 'hssc' });
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'miniapp',
      via: 'deeplink',
      item_id: 'hssc',
      src: undefined,
    });
  });

  it('intercepts the map with a place and leaves the place for the campus screen', () => {
    // Act
    const route = warm('/map?place=skku_building:hall-1');

    // Assert
    expect(route).toBe('/(tabs)/campus');
    expect(pending.mapPlace).toHaveBeenCalledWith({ kind: 'skku_building', placeId: 'hall-1', tab: 'map' });
  });

  it('opens the campus tab with no place for a map link whose place is unknown or missing', () => {
    // Act / Assert
    expect(warm('/map?place=future_kind:x')).toBe('/(tabs)/campus');
    expect(warm('/map')).toBe('/(tabs)/campus');
    expect(pending.mapPlace).not.toHaveBeenCalled();
  });

  it('keeps /map/hssc off the map interception', () => {
    // Act / Assert
    expect(warm('/map/hssc')).toBe('/map/hssc');
    expect(pending.mapPlace).not.toHaveBeenCalled();
  });

  it('passes a campaign tag to the log and nowhere else', () => {
    // Act
    const route = warm('/home?src=poster_a');

    // Assert
    expect(route).toBe('/(tabs)/home');
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'static',
      via: 'deeplink',
      item_id: '/home',
      src: 'poster_a',
    });
  });


  it('strips the shared-link prefix from a mini-app link too', () => {
    // Act
    const route = warm('/p/m/hssc');

    // Assert
    expect(route).toBe('/(tabs)/home');
    expect(pending.miniApp).toHaveBeenCalledWith({ id: 'hssc' });
  });

  it.each([
    ['/m/', '/m/'],
    ['/m/Bad Slug!', '/m/Bad%20Slug!'],
  ])('logs the malformed mini-app path %s as blocked and sends it home', (path, logged) => {
    // Act / Assert
    expect(warm(path)).toBe('/(tabs)/home');
    expect(pending.miniApp).not.toHaveBeenCalled();
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'blocked',
      via: 'deeplink',
      item_id: logged,
      src: undefined,
    });
  });

  it('sends a link home when handling it throws', () => {
    // Arrange
    pending.track.mockImplementationOnce(() => {
      throw new Error('sink down');
    });

    // Act / Assert
    expect(warm('/search')).toBe('/(tabs)/home');
  });
});

// The redirect never reads the shell: a line link lands on the transit tab under
// both, and only the tab's route file decides what drains it (ADR 0023 d4).
describe.each(['native-tabs', 'shared-map'] as const)('a transit line link under the %s shell', (shell) => {
  beforeEach(() => {
    vi.doMock('@/bootstrap/shell.service', () => ({ SHELL: shell }));
  });

  it('intercepts /transit?line= and leaves the line for the transit tab', () => {
    // Act
    const route = warm('/transit?line=jongro07');

    // Assert
    expect(route).toBe('/(tabs)/transit');
    expect(pending.transitLine).toHaveBeenCalledWith({ kind: 'line', groupId: 'jongro07', source: 'deeplink' });
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'transit_line',
      via: 'deeplink',
      item_id: 'jongro07',
      src: undefined,
    });
  });

  it('strips the shared-link prefix from a line link, cold and warm', () => {
    // Act / Assert
    expect(cold('skkuverse:///p/transit?line=hssc')).toBe('/(tabs)/transit');
    expect(warm('/p/transit?line=hssc')).toBe('/(tabs)/transit');
    expect(pending.transitLine).toHaveBeenCalledTimes(2);
    expect(pending.transitLine).toHaveBeenLastCalledWith({ kind: 'line', groupId: 'hssc', source: 'deeplink' });
  });

  it.each(['/transit?line=', '/transit?line=Bad%20Line', '/transit?line=jongro07/extra', '/transit?line=-hssc'])(
    'opens the transit tab with no line for %s',
    (path) => {
      // Act / Assert
      expect(warm(path)).toBe('/(tabs)/transit');
      expect(pending.transitLine).not.toHaveBeenCalled();
      expect(pending.track).toHaveBeenLastCalledWith('link_open', {
        kind: 'static',
        via: 'deeplink',
        item_id: '/transit',
        src: undefined,
      });
    },
  );

  it('keeps a plain /transit a static tab link', () => {
    // Act / Assert
    expect(warm('/transit')).toBe('/(tabs)/transit');
    expect(pending.transitLine).not.toHaveBeenCalled();
  });
});

// A map link may name a chip beside or instead of a place (ADR 0022 d7). The
// redirect never reads the shell: the map tab's ViewModel runs the chip under both.
describe.each(['native-tabs', 'shared-map'] as const)('a map chip link under the %s shell', (shell) => {
  beforeEach(() => {
    vi.doMock('@/bootstrap/shell.service', () => ({ SHELL: shell }));
  });

  it('leaves the chip for the map tab and opens the campus tab', () => {
    // Act
    const route = warm('/map?chip=eskara_food');

    // Assert
    expect(route).toBe('/(tabs)/campus');
    expect(pending.mapChip).toHaveBeenCalledWith({ chipId: 'eskara_food', source: 'deeplink' });
    expect(pending.mapPlace).not.toHaveBeenCalled();
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'map_place',
      via: 'deeplink',
      item_id: 'chip:eskara_food',
      src: undefined,
    });
  });

  it('leaves the chip before the place, so the place opens over the chip', () => {
    // Act
    const route = cold('skkuverse://map?place=event:booth-1&chip=eskara-food');

    // Assert
    expect(route).toBe('/(tabs)/campus');
    expect(pending.mapChip).toHaveBeenCalledWith({ chipId: 'eskara-food', source: 'deeplink' });
    expect(pending.mapPlace).toHaveBeenCalledWith({ kind: 'event', placeId: 'booth-1', tab: 'map' });
    expect(pending.mapChip.mock.invocationCallOrder[0]).toBeLessThan(pending.mapPlace.mock.invocationCallOrder[0] ?? 0);
    expect(pending.track).toHaveBeenLastCalledWith('link_open', {
      kind: 'map_place',
      via: 'deeplink',
      item_id: 'event:booth-1',
      src: undefined,
    });
  });

  it.each(['/map?chip=', '/map?chip=Bad%20Chip', '/map?chip=-food', '/map?chip=UPPER'])(
    'ignores the malformed chip in %s and still opens the campus tab',
    (path) => {
      // Act / Assert
      expect(warm(path)).toBe('/(tabs)/campus');
      expect(pending.mapChip).not.toHaveBeenCalled();
    },
  );

  it('keeps the place of a link whose chip is malformed', () => {
    // Act
    warm('/map?place=skku_building:2&chip=Bad%20Chip');

    // Assert
    expect(pending.mapPlace).toHaveBeenCalledWith({ kind: 'skku_building', placeId: '2', tab: 'map' });
    expect(pending.mapChip).not.toHaveBeenCalled();
  });
});

describe('app/+native-intent', () => {
  it('re-exports the redirect Expo Router reads, so the whitelist applies to every link', () => {
    // Assert
    expect(routeRedirect).toBe(redirectSystemPath);
  });
});
