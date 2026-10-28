import { expect, test } from 'vitest';
import { GAME_NOTIFY_METHODS, NOTIFY_METHODS } from '@skkuverse/miniapp/protocol';
import {
  bridgedOrigin,
  resolveMiniAppCapabilities,
  resolveWebviewCapabilities,
  FIRST_PARTY_CAPABILITIES,
} from './capabilities.rules';

const ALLOWED = ['https://webview.legacy.example.com'];
// `miniapps.origins`: each first-party mini-app origin and the one app it belongs to.
const MINIAPP_ORIGINS = {
  'https://eskara.miniapp.skkuverse.com': 'eskara-2026',
  'https://mukja.mini.skkuverse.com': 'mukja',
};

test('grants the first-party set to an allowlisted origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.legacy.example.com/#/skku/lostandfound',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect([...caps]).toStrictEqual([...FIRST_PARTY_CAPABILITIES]);
});

test('ignores path, query and hash when matching the origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.legacy.example.com/deep/path?a=1#/bus/hssc/info',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect(caps.length).toBe(FIRST_PARTY_CAPABILITIES.length);
});

test('grants nothing to a notice source page', () => {
  // The case this whole gate exists for: an arbitrary university page now
  // reaches this screen, and must not be able to drive the app.
  const caps = resolveWebviewCapabilities(
    'https://www.skku.edu/skku/campus/skk_comm/notice.do',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect([...caps]).toStrictEqual([]);
});

test('grants nothing after the page navigates off the allowed origin', () => {
  // A grant made when the screen opened would still be live here. Resolving
  // per message from nativeEvent.url is what prevents that.
  const caps = resolveWebviewCapabilities('https://evil.test/landing', ALLOWED, MINIAPP_ORIGINS);
  expect([...caps]).toStrictEqual([]);
});

test('does not match a look-alike host', () => {
  for (const url of [
    'https://webview.legacy.example.com.evil.test/',
    'https://evil.test/?x=https://webview.legacy.example.com',
    'https://notwebview.legacy.example.com/',
    'https://sub.webview.legacy.example.com/',
  ]) {
    expect([...resolveWebviewCapabilities(url, ALLOWED, MINIAPP_ORIGINS)], `should not grant: ${url}`).toStrictEqual([]);
  }
});

test('treats http as a different origin from https', () => {
  // Origin comparison includes the scheme, so a downgraded page loses the
  // bridge rather than inheriting it.
  const caps = resolveWebviewCapabilities(
    'http://webview.legacy.example.com/',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect([...caps]).toStrictEqual([]);
});

test('treats a non-default port as a different origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.legacy.example.com:8443/',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect([...caps]).toStrictEqual([]);
});

test('grants nothing when the allowlist is empty (fail-closed)', () => {
  // Config never fetched, fetch failed, or the server sent none.
  const caps = resolveWebviewCapabilities(
    'https://webview.legacy.example.com/',
    [],
    MINIAPP_ORIGINS,
  );
  expect([...caps]).toStrictEqual([]);
});

test('grants nothing for an undefined or unparseable url', () => {
  expect([...resolveWebviewCapabilities(undefined, ALLOWED, MINIAPP_ORIGINS)]).toStrictEqual([]);
  expect([...resolveWebviewCapabilities('', ALLOWED, MINIAPP_ORIGINS)]).toStrictEqual([]);
  expect([...resolveWebviewCapabilities('not a url', ALLOWED, MINIAPP_ORIGINS)]).toStrictEqual([]);
});

test('grants nothing for opaque origins that stringify to "null"', () => {
  // `new URL('data:...').origin === 'null'`. If "null" ever entered the
  // allowlist this would otherwise match.
  for (const url of ['data:text/html,<h1>hi</h1>', 'about:blank']) {
    expect([...resolveWebviewCapabilities(url, ALLOWED, MINIAPP_ORIGINS)]).toStrictEqual([]);
    expect([...resolveWebviewCapabilities(url, ['null'], MINIAPP_ORIGINS)]).toStrictEqual([]);
  }
});

test('never grants web:navigate', () => {
  // Our SPA has never sent it, and the old handler ran router.push() on it
  // unguarded. Regression guard against it being re-added without a path
  // allowlist.
  const caps = resolveWebviewCapabilities(
    'https://webview.legacy.example.com/',
    ALLOWED,
    MINIAPP_ORIGINS,
  );
  expect(caps.includes('web:navigate')).toBe(false);
});

test('grants web:haptic to a first-party page only', () => {
  // The setlist mini app's counter buzzes the phone through it. A notice
  // source page must not be able to.
  expect(resolveWebviewCapabilities('https://webview.legacy.example.com/', ALLOWED, MINIAPP_ORIGINS).includes('web:haptic')).toBe(true);
  expect(resolveWebviewCapabilities('https://www.skku.edu/notice.do', ALLOWED, MINIAPP_ORIGINS).includes('web:haptic')).toBe(false);
});

test('bridgedOrigin returns the matched origin, or null', () => {
  expect(bridgedOrigin('https://webview.legacy.example.com/a?b#c', ALLOWED)).toBe('https://webview.legacy.example.com');
  expect(bridgedOrigin('https://evil.test/', ALLOWED)).toBe(null);
  expect(bridgedOrigin('data:text/html,x', ['null'])).toBe(null);
  expect(bridgedOrigin(undefined, ALLOWED)).toBe(null);
});

// ── Mini-app shell: the miniapp protocol's methods over the same gate ──

const MINIAPP_ALLOWED = ['https://eskara.miniapp.skkuverse.com'];

test('grants every miniapp notify method to an allowlisted mini-app origin', () => {
  const caps = resolveMiniAppCapabilities('https://eskara.miniapp.skkuverse.com/booths', MINIAPP_ALLOWED, MINIAPP_ORIGINS, 'eskara-2026');
  expect([...caps]).toStrictEqual([...NOTIFY_METHODS]);
});

test('grants a mini-app origin no game method', () => {
  // Act
  const caps: readonly string[] = resolveMiniAppCapabilities('https://eskara.miniapp.skkuverse.com/', MINIAPP_ALLOWED, MINIAPP_ORIGINS, 'eskara-2026');

  // Assert
  expect(caps.filter((method) => (GAME_NOTIFY_METHODS as readonly string[]).includes(method))).toStrictEqual([]);
  expect(caps.some((method) => method.startsWith('game.'))).toBe(false);
});

test('grants a mini-app page nothing off the allowlist, or with none fetched', () => {
  for (const [url, allowed] of [
    ['https://third-party.example/', MINIAPP_ALLOWED],
    ['https://eskara.miniapp.skkuverse.com.evil.test/', MINIAPP_ALLOWED],
    ['http://eskara.miniapp.skkuverse.com/', MINIAPP_ALLOWED],
    ['https://eskara.miniapp.skkuverse.com/', []],
    [undefined, MINIAPP_ALLOWED],
    ['about:blank', ['null']],
  ] as const) {
    expect([...resolveMiniAppCapabilities(url, allowed, MINIAPP_ORIGINS, 'eskara-2026')], `should not grant: ${url}`).toStrictEqual([]);
  }
});

// ── Grants bound to the app id (`miniapps.origins`) ──

const BOTH_ALLOWED = ['https://webview.legacy.example.com', 'https://eskara.miniapp.skkuverse.com', 'https://mukja.mini.skkuverse.com'];

test("grants a sibling mini app's origin nothing inside another app's shell", () => {
  // Act
  const caps = resolveMiniAppCapabilities('https://mukja.mini.skkuverse.com/', BOTH_ALLOWED, MINIAPP_ORIGINS, 'eskara-2026');

  // Assert
  expect([...caps]).toStrictEqual([]);
});

test("grants a mini app's own origin the full set in its own shell", () => {
  // Act
  const caps = resolveMiniAppCapabilities('https://mukja.mini.skkuverse.com/spin', BOTH_ALLOWED, MINIAPP_ORIGINS, 'mukja');

  // Assert
  expect([...caps]).toStrictEqual([...NOTIFY_METHODS]);
});

test('grants a mini-app shell nothing for a bridged origin no mini app owns, or without an id', () => {
  // Assert
  expect([...resolveMiniAppCapabilities('https://webview.legacy.example.com/', BOTH_ALLOWED, MINIAPP_ORIGINS, 'mukja')]).toStrictEqual([]);
  expect([...resolveMiniAppCapabilities('https://mukja.mini.skkuverse.com/', BOTH_ALLOWED, MINIAPP_ORIGINS, undefined)]).toStrictEqual([]);
  expect([...resolveMiniAppCapabilities('https://webview.legacy.example.com/', BOTH_ALLOWED, MINIAPP_ORIGINS, undefined)]).toStrictEqual([]);
  expect([...resolveMiniAppCapabilities('https://mukja.mini.skkuverse.com/', BOTH_ALLOWED, {}, 'mukja')]).toStrictEqual([]);
});

test('grants a mini-app origin nothing in /webview', () => {
  // Act
  const caps = resolveWebviewCapabilities('https://mukja.mini.skkuverse.com/', BOTH_ALLOWED, MINIAPP_ORIGINS);

  // Assert
  expect([...caps]).toStrictEqual([]);
  expect([...resolveWebviewCapabilities('https://webview.legacy.example.com/', BOTH_ALLOWED, MINIAPP_ORIGINS)]).toStrictEqual([...FIRST_PARTY_CAPABILITIES]);
});
