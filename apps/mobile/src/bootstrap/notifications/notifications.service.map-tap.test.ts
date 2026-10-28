/**
 * A push naming a map chip or place beside the route `/campus` (ADR 0022 d7),
 * from the tap to what the map tab is left: the chip and the place are stashed
 * with source `push` before the campus tab is navigated to, so a mounted map
 * tab takes them on the same tap. Only the router, the queues, the log and
 * the native wrappers are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateFromNotification } from './notifications.service';

const spies = vi.hoisted(() => ({
  navigate: vi.fn(),
  chip: vi.fn(),
  place: vi.fn(),
  sdui: vi.fn(),
  track: vi.fn(),
}));

vi.mock('expo-router', () => ({ router: { navigate: spies.navigate } }));
vi.mock('@/features/map/map.service', () => ({
  pendingMapChipLink: { set: spies.chip },
  pendingMapPlaceLink: { set: spies.place },
}));
vi.mock('@/features/web/web.service', () => ({ pendingMiniAppLink: { set: vi.fn() }, pendingSduiAction: { set: spies.sdui } }));
vi.mock('@/features/notices/notices.service', () => ({ pendingExternalNoticeLink: { set: vi.fn() } }));
vi.mock('@/platform/analytics', () => ({ track: spies.track }));
vi.mock('@/platform/dev-log', () => ({ devLog: vi.fn() }));
// WHY: expo-notifications and MMKV cannot load in Node.
vi.mock('@/platform/notifications', () => ({ AndroidImportance: {} }));
vi.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: vi.fn(), set: vi.fn() }) }));
vi.mock('@skkuverse/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@skkuverse/shared')>()),
  getGameOrigins: () => ({}),
}));

beforeEach(() => {
  for (const spy of Object.values(spies)) spy.mockClear();
});

const push = (extra: Record<string, string>) =>
  navigateFromNotification({ type: 'miniapp', miniAppId: 'eskara-2026', actionType: 'route', actionValue: '/campus', ...extra });

describe('a push naming a map chip or place', () => {
  it('stashes the chip and the place for the map tab, then opens the campus tab', () => {
    // Act
    const handled = push({ chipId: 'eskara_food', placeId: 'event:booth-1' });

    // Assert
    expect(handled).toBe(true);
    expect(spies.chip).toHaveBeenCalledWith({ chipId: 'eskara_food', source: 'push' });
    expect(spies.place).toHaveBeenCalledWith({ kind: 'event', placeId: 'booth-1', source: 'push', tab: 'map' });
    expect(spies.navigate).toHaveBeenCalledWith('/(tabs)/campus');
    expect(spies.chip.mock.invocationCallOrder[0]).toBeLessThan(spies.place.mock.invocationCallOrder[0] ?? 0);
    expect(spies.place.mock.invocationCallOrder[0]).toBeLessThan(spies.navigate.mock.invocationCallOrder[0] ?? 0);
    expect(spies.sdui).not.toHaveBeenCalled();
    expect(spies.track).toHaveBeenCalledWith('link_open', { kind: 'map_place', via: 'push', item_id: 'event:booth-1' });
  });

  it('logs a chip alone by its id', () => {
    // Act
    push({ chipId: 'eskara_food' });

    // Assert
    expect(spies.place).not.toHaveBeenCalled();
    expect(spies.track).toHaveBeenCalledWith('link_open', { kind: 'map_place', via: 'push', item_id: 'chip:eskara_food' });
  });

  it('routes to /campus as today when neither id is valid', () => {
    // Act
    push({ chipId: 'Bad Chip' });

    // Assert
    expect(spies.chip).not.toHaveBeenCalled();
    expect(spies.place).not.toHaveBeenCalled();
    expect(spies.sdui).toHaveBeenCalledWith({ actionType: 'route', actionValue: '/campus' });
  });
});
