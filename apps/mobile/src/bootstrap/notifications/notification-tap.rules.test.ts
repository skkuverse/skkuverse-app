/**
 * Where a notification tap lands.
 *
 * Two properties matter more than the individual cases. First, an action type
 * newer than this build must never reach a URL opener as a raw string — that was
 * the failure `parseActionType`'s `'unknown'` sentinel was introduced to stop,
 * and this resolver must not reintroduce it one layer up. Second, a mini-app
 * push must not produce a dead tap: anything the build cannot navigate falls
 * back to the mini app itself, resolved by id through the registry.
 */

import { describe, it, expect } from 'vitest';
import { resolveNotificationTap } from './notification-tap.rules';

const NO_GAME_ORIGINS: Readonly<Record<string, string>> = {};

describe('resolveNotificationTap', () => {
  describe('nothing to do', () => {
    it('returns null for undefined data', () => {
      expect(resolveNotificationTap(undefined, NO_GAME_ORIGINS)).toBeNull();
    });

    it('returns null when type is missing or empty', () => {
      expect(resolveNotificationTap({}, NO_GAME_ORIGINS)).toBeNull();
      expect(resolveNotificationTap({ type: '' }, NO_GAME_ORIGINS)).toBeNull();
    });

    it('returns null for an unrecognised message type', () => {
      expect(resolveNotificationTap({ type: 'bus-arrival' }, NO_GAME_ORIGINS)).toBeNull();
    });

    it('returns null for eventmap-refresh, which is silent and never tapped', () => {
      expect(resolveNotificationTap({ type: 'eventmap-refresh', miniAppId: 'eskara' }, NO_GAME_ORIGINS)).toBeNull();
    });
  });

  describe('notice — unchanged behaviour', () => {
    it('resolves a complete notice payload', () => {
      expect(
        resolveNotificationTap({ type: 'notice', sourceId: 'cse', articleNo: '5847' }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'notice', sourceId: 'cse', articleNo: '5847' });
    });

    it.each([
      ['no articleNo', { type: 'notice', sourceId: 'cse' }],
      ['no sourceId', { type: 'notice', articleNo: '5847' }],
      ['empty sourceId', { type: 'notice', sourceId: '', articleNo: '5847' }],
    ])('returns null with %s', (_label, data) => {
      expect(resolveNotificationTap(data, NO_GAME_ORIGINS)).toBeNull();
    });
  });

  describe('miniapp — a target this build can navigate', () => {
    // Values differ by type on purpose: `route` is an in-app path, the other two
    // must be https (see isAcceptableValue).
    it.each([
      ['route', '/campus'],
      ['webview', 'https://webview.skkuverse.com/eskara'],
      ['external', 'https://eskara.skku.edu'],
    ] as const)('dispatches %s as an SDUI action', (actionType, actionValue) => {
      expect(
        resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara', actionType, actionValue }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'sdui-action', actionType, actionValue });
    });

    it("maps the legacy 'url' spelling onto external, as parseActionType does", () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType: 'url',
          actionValue: 'https://x.test/a',
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'sdui-action', actionType: 'external', actionValue: 'https://x.test/a' });
    });
  });

  describe('miniapp — a page of the same mini app', () => {
    it('opens the page a miniapp target names', () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara-2026',
          actionType: 'miniapp',
          actionValue: 'eskara-2026/eskara/wristband',
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara-2026', path: '/eskara/wristband' });
    });

    it('opens the start page for a bare target', () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara-2026',
          actionType: 'miniapp',
          actionValue: 'eskara-2026',
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });
  });

  describe('miniapp — falling back to the mini app itself', () => {
    it('falls back when the payload names no target', () => {
      expect(resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara' }, NO_GAME_ORIGINS)).toEqual({
        kind: 'miniapp',
        id: 'eskara',
      });
    });

    it('falls back for an action type newer than this build, rather than opening the raw string', () => {
      const tap = resolveNotificationTap({
        type: 'miniapp',
        miniAppId: 'eskara',
        actionType: 'teleport',
        actionValue: 'javascript:alert(1)',
      }, NO_GAME_ORIGINS);
      expect(tap).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it.each(['content', 'miniapp'])('falls back for %s with a URL value', (actionType) => {
      // A `miniapp` value is a target, never a URL — a URL is not opened.
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType,
          actionValue: 'https://x.test/a',
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it.each([
      ['a path that escapes the origin', 'eskara//evil.com'],
    ])('ignores a miniapp target naming %s', (_label, actionValue) => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType: 'miniapp',
          actionValue,
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it('falls back when actionValue is empty despite a valid actionType', () => {
      expect(
        resolveNotificationTap({
          type: 'miniapp',
          miniAppId: 'eskara',
          actionType: 'webview',
          actionValue: '',
        }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it.each([
      ['a non-web scheme on external', 'external', 'itms-apps://apps.apple.com/app/id1'],
      ['a non-web scheme on webview', 'webview', 'tel:+8215771577'],
      ['plain http', 'webview', 'http://x.test/a'],
      ['an embedded space', 'webview', 'https://x.test/a b'],
      ['a route that is not a path', 'route', 'https://x.test/a'],
    ])('falls back for %s rather than handing it to an opener', (_label, actionType, actionValue) => {
      expect(
        resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara', actionType, actionValue }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara' });
    });

    it('returns null when there is no miniAppId to fall back to', () => {
      expect(resolveNotificationTap({ type: 'miniapp' }, NO_GAME_ORIGINS)).toBeNull();
      expect(
        resolveNotificationTap({ type: 'miniapp', actionType: 'teleport', actionValue: 'x' }, NO_GAME_ORIGINS),
      ).toBeNull();
    });
  });

  describe('miniapp — a route must be one a push may open', () => {
    const tapOn = (actionType: string, actionValue: string) =>
      resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara-2026', actionType, actionValue }, NO_GAME_ORIGINS);

    it.each(['/home', '/campus', '/transit', '/map/hssc', '/search', '/miniapp-feed/eskara-2026'])(
      'opens %s',
      (route) => {
        // Act & Assert
        expect(tapOn('route', route)).toEqual({ kind: 'sdui-action', actionType: 'route', actionValue: route });
      },
    );

    it.each([
      ['a protocol-relative URL, which the router opens in the system browser', '//evil.com'],
      ['a backslash authority', '/\\evil.com'],
      ['the web view opener', '/webview?url=https://evil.example'],
      ['the mini-app opener', '/mini-app?id=inja&source=push'],
      ['a game', '/games/apple-game'],
      ['a settings screen', '/settings/account'],
      ["another mini app's feed", '/miniapp-feed/other'],
      ['its own feed with a query', '/miniapp-feed/eskara-2026?x=1'],
      ['an allowed path with a query', '/campus?x=1'],
      ['a notice, which has its own message type', '/notices/cse/5847'],
      ['bare root', '/'],
    ])('falls back to the sender for %s', (_case, route) => {
      // Act & Assert
      expect(tapOn('route', route)).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });

    it.each([
      ['webview', 'https://u:p@x.test/a'],
      ['external', 'https://u@x.test/a'],
    ])('falls back to the sender for a %s URL carrying userinfo', (actionType, actionValue) => {
      // Act & Assert
      expect(tapOn(actionType, actionValue)).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });
  });

  describe('miniapp — a web page on a first-party game origin', () => {
    const GAME_ORIGINS = { 'https://apple-game.game.skkuverse.com': 'apple-game' };
    const tapOn = (actionType: string, actionValue: string) =>
      resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara-2026', actionType, actionValue }, GAME_ORIGINS);

    it.each([
      ['webview', 'https://apple-game.game.skkuverse.com/'],
      ['external', 'https://apple-game.game.skkuverse.com/play?x=1'],
    ])('falls back to the sender for a %s URL that would open the game', (actionType, actionValue) => {
      // Act & Assert
      expect(tapOn(actionType, actionValue)).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });

    it('still opens a page on any other origin', () => {
      // Act & Assert
      expect(tapOn('webview', 'https://webview.skkuverse.com/eskara')).toEqual({
        kind: 'sdui-action',
        actionType: 'webview',
        actionValue: 'https://webview.skkuverse.com/eskara',
      });
    });
  });

  describe('miniapp — a target naming another registered mini app', () => {
    const tapOn = (actionValue: string) =>
      resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara-2026', actionType: 'miniapp', actionValue }, NO_GAME_ORIGINS);

    it('opens that mini app at the page named, for its consumer to check against the registry', () => {
      // Act & Assert
      expect(tapOn('inja/notice')).toEqual({ kind: 'miniapp', id: 'inja', path: '/notice' });
    });

    it('opens its start page for a bare target', () => {
      // Act & Assert
      expect(tapOn('timetable')).toEqual({ kind: 'miniapp', id: 'timetable' });
    });

    it.each(['apple-game', 'subway-typing/x'])('falls back to the sender for a game, %s', (actionValue) => {
      // Act & Assert
      expect(tapOn(actionValue)).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });

    it('falls back to the sender for a path that escapes the origin', () => {
      // Act & Assert
      expect(tapOn('inja//evil.com')).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });
  });

  // ADR 0022 d7: a push keeps its route `/campus` and names the map's chip or
  // place in two extra keys, which installed builds ignore.
  describe('miniapp — a chip or a place beside the route /campus', () => {
    const tapOn = (extra: Record<string, unknown>, actionValue = '/campus') =>
      resolveNotificationTap(
        { type: 'miniapp', miniAppId: 'eskara-2026', actionType: 'route', actionValue, ...extra },
        NO_GAME_ORIGINS,
      );

    it('opens the chip it names', () => {
      // Act & Assert
      expect(tapOn({ chipId: 'eskara_food' })).toEqual({ kind: 'map', chipId: 'eskara_food', place: null });
    });

    it('opens the place it names', () => {
      // Act & Assert
      expect(tapOn({ placeId: 'event:booth-1' })).toEqual({
        kind: 'map',
        chipId: null,
        place: { kind: 'event', placeId: 'booth-1' },
      });
    });

    it('opens both, a bare place id read as it always has been', () => {
      // Act & Assert
      expect(tapOn({ chipId: 'eskara-food', placeId: 'booth-1' })).toEqual({
        kind: 'map',
        chipId: 'eskara-food',
        place: { kind: null, placeId: 'booth-1' },
      });
    });

    it('ignores an invalid id and keeps the other', () => {
      // Act & Assert
      expect(tapOn({ chipId: 'Bad Chip', placeId: 'skku_building:2' })).toEqual({
        kind: 'map',
        chipId: null,
        place: { kind: 'skku_building', placeId: '2' },
      });
    });

    it.each([
      ['an invalid chip', { chipId: '-food' }],
      ['a place of a kind this build does not know', { placeId: 'future_kind:x' }],
      ['both invalid', { chipId: 'UPPER', placeId: '../../etc' }],
      ['values FCM could never have sent', { chipId: 7, placeId: ['booth-1'] }],
    ])('falls back to the route as today for %s', (_label, extra) => {
      // Act & Assert
      expect(tapOn(extra)).toEqual({ kind: 'sdui-action', actionType: 'route', actionValue: '/campus' });
    });

    it('keeps any other route as today, ignoring the keys', () => {
      // Act & Assert
      expect(tapOn({ chipId: 'eskara_food' }, '/home')).toEqual({
        kind: 'sdui-action',
        actionType: 'route',
        actionValue: '/home',
      });
    });

    it('keeps a push with no route as today, landing on the mini app', () => {
      // Act & Assert
      expect(
        resolveNotificationTap({ type: 'miniapp', miniAppId: 'eskara-2026', chipId: 'eskara_food' }, NO_GAME_ORIGINS),
      ).toEqual({ kind: 'miniapp', id: 'eskara-2026' });
    });
  });

  describe('non-string values cannot smuggle through', () => {
    it('ignores fields FCM could never have sent as strings', () => {
      const hostile = {
        type: 'miniapp',
        miniAppId: 7,
        actionType: { actionType: 'webview' },
        actionValue: ['https://x.test'],
      } as unknown as Parameters<typeof resolveNotificationTap>[0];
      expect(resolveNotificationTap(hostile, NO_GAME_ORIGINS)).toBeNull();
    });
  });
});
