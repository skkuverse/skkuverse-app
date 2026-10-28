import { expect, test } from 'vitest';
import {
  decideMiniAppNavigation,
  decideNavigation,
  isOpenableUrl,
  schemeOf,
  toMiniAppOwnOrigins,
  toMiniAppPinnedOrigins,
} from './navigation.rules';
import {
  DECLARED_APP_PACKAGES,
  DECLARED_APP_SCHEMES,
  OPENABLE_APP_SCHEMES,
} from '../../../config/external-apps.js';

const APPS = { schemes: DECLARED_APP_SCHEMES, packages: DECLARED_APP_PACKAGES };
const top = (url: string) => decideNavigation({ url, isTopFrame: true }, APPS);
const frame = (url: string) => decideNavigation({ url, isTopFrame: false }, APPS);

test('web documents load, in the top frame and in iframes alike', () => {
  for (const url of [
    'https://pf.kakao.com/_cjxexdG',
    'http://example.com',
    'about:blank',
    'about:srcdoc',
    'data:text/html,<p>x</p>',
    'blob:https://example.com/3f2a',
  ]) {
    expect(top(url), url).toStrictEqual({ kind: 'load' });
    expect(frame(url), url).toStrictEqual({ kind: 'load' });
  }
});

test('a declared app scheme opens from the top frame', () => {
  expect(top('kakaotalk://launch')).toStrictEqual({ kind: 'open', url: 'kakaotalk://launch' });
  expect(top('NMAP://place?id=1')).toStrictEqual({ kind: 'open', url: 'NMAP://place?id=1' });
});

test('Android reports no isTopFrame=false, so its requests count as top-frame', () => {
  expect(decideNavigation({ url: 'kakaomap://look' }, APPS)).toStrictEqual({
    kind: 'open',
    url: 'kakaomap://look',
  });
});

test('an iframe never leaves the app, whatever the scheme', () => {
  for (const url of ['kakaotalk://launch', 'tel:0212345678', 'intent://x#Intent;scheme=kakaoplus;package=com.kakao.talk;end']) {
    expect(frame(url), url).toStrictEqual({ kind: 'block' });
  }
});

test('an undeclared app scheme is dropped, even from the top frame', () => {
  for (const url of ['supertoss://send', 'tmap://route', 'youtube://watch?v=x', 'itms-apps://x', 'javascript:alert(1)', 'file:///etc/hosts']) {
    expect(top(url), url).toStrictEqual({ kind: 'block' });
  }
});

test('tel, mailto and sms links open as tapped links always did', () => {
  for (const url of ['tel:0212345678', 'mailto:student@skku.edu', 'sms:01012345678']) {
    expect(top(url), url).toStrictEqual({ kind: 'open', url });
  }
});

test('Apple Maps opens from the top frame, as a page may open it by message', () => {
  // Act & Assert
  expect(top('maps://?q=37.58,126.99')).toStrictEqual({ kind: 'open', url: 'maps://?q=37.58,126.99' });
});

test('a navigation hands the OS only what a page could open by message', () => {
  // Arrange
  const urls = [
    'tel:0212345678',
    'maps://?q=1',
    'kakaotalk://launch',
    'intent://x#Intent;scheme=kakaoplus;package=com.kakao.talk;S.browser_fallback_url=https%3A%2F%2Fpf.kakao.com;end',
    'javascript:alert(1)',
    'file:///etc/hosts',
    'itms-apps://x',
    'market://details?id=x',
    'youtube://watch?v=x',
    'supertoss://send',
  ];

  // Act
  const opened = urls.map(top).flatMap((d) => (d.kind === 'open' ? [d.url, ...(d.fallback ? [d.fallback] : [])] : []));

  // Assert
  expect(opened.length).toBe(5);
  for (const url of opened) expect(isOpenableUrl(url, DECLARED_APP_SCHEMES), url).toBe(true);
});

test('a scheme-less or empty URL is dropped', () => {
  expect(top('')).toStrictEqual({ kind: 'block' });
  expect(top('//example.com')).toStrictEqual({ kind: 'block' });
});

test("Kakao's intent:// opens KakaoTalk, keeping its https fallback", () => {
  const url =
    'intent://plusfriend/talk/chat/_cjxexdG#Intent;scheme=kakaoplus;package=com.kakao.talk;' +
    'S.browser_fallback_url=https%3A%2F%2Fpf.kakao.com%2F_cjxexdG%2Fchat;end';
  expect(top(url)).toStrictEqual({
    kind: 'open',
    url: 'kakaoplus://plusfriend/talk/chat/_cjxexdG',
    fallback: 'https://pf.kakao.com/_cjxexdG/chat',
  });
});

test("Naver Map's intent:// opens the app and drops a non-https fallback", () => {
  const url =
    'intent://route/walk?dlat=37.58&dlng=126.99#Intent;scheme=nmap;package=com.nhn.android.nmap;' +
    'S.browser_fallback_url=market%3A%2F%2Fdetails%3Fid%3Dcom.nhn.android.nmap;end';
  expect(top(url)).toStrictEqual({ kind: 'open', url: 'nmap://route/walk?dlat=37.58&dlng=126.99' });
});

test("Toss's intent:// is dropped: neither its scheme nor its package is declared", () => {
  const url =
    'intent://toss.im/transfer#Intent;scheme=supertoss;package=viva.republica.toss;' +
    'S.browser_fallback_url=https%3A%2F%2Ftoss.im;end';
  expect(top(url)).toStrictEqual({ kind: 'block' });
});

test('an intent:// needs a declared scheme AND a declared package', () => {
  // A declared package cannot smuggle out a web address or another app's scheme.
  expect(top('intent://evil.example#Intent;scheme=https;package=com.kakao.talk;end')).toStrictEqual({ kind: 'block' });
  expect(top('intent://x#Intent;scheme=supertoss;package=com.kakao.talk;end')).toStrictEqual({ kind: 'block' });
  expect(top('intent://x#Intent;scheme=kakaoplus;package=viva.republica.toss;end')).toStrictEqual({ kind: 'block' });
  expect(top('intent://x#Intent;scheme=kakaoplus;end')).toStrictEqual({ kind: 'block' });
  expect(top('intent://x')).toStrictEqual({ kind: 'block' });
});

test('a malformed fallback is dropped rather than thrown', () => {
  const url = 'intent://x#Intent;scheme=kakaotalk;package=com.kakao.talk;S.browser_fallback_url=%E0%A4%A;end';
  expect(top(url)).toStrictEqual({ kind: 'open', url: 'kakaotalk://x' });
});

test('schemeOf lower-cases and needs a leading letter', () => {
  expect(schemeOf('Vnd.YouTube:abc')).toBe('vnd.youtube');
  expect(schemeOf('  https://x')).toBe('https');
  expect(schemeOf('1http://x')).toBe(null);
});

test('the declared iOS schemes stay under the iOS 27 query cap of 25', () => {
  expect(new Set(DECLARED_APP_SCHEMES).size <= 25).toBeTruthy();
  expect(new Set(DECLARED_APP_SCHEMES).size, 'no duplicates').toBe(DECLARED_APP_SCHEMES.length);
});

test('every declared scheme can also be opened from an appUrl', () => {
  for (const scheme of DECLARED_APP_SCHEMES) expect(OPENABLE_APP_SCHEMES.includes(scheme), scheme).toBeTruthy();
});

// ── What a page's `web:open-url` (or a mini app's `link.open`) may open ──

test('a page may open the web, the OS handlers, Apple Maps and a declared app', () => {
  for (const url of [
    'https://open.spotify.com/track/x',
    'http://example.com',
    'tel:0212345678',
    'mailto:help@example.com',
    'sms:01012345678',
    'maps://?q=37.58,126.99',
    'nmap://place?id=1',
    'kakaomap://look?p=37.58,126.99',
    'SPOTIFY:track:x',
  ]) {
    expect(isOpenableUrl(url, OPENABLE_APP_SCHEMES), url).toBe(true);
  }
});

test('a page may not open script, intent, file, data or an undeclared app', () => {
  for (const url of [
    'javascript:alert(1)',
    'intent://x#Intent;scheme=nmap;package=com.nhn.android.nmap;end',
    'file:///etc/hosts',
    'data:text/html,<script>1</script>',
    'supertoss://send',
    'not a url',
    '',
  ]) {
    expect(isOpenableUrl(url, OPENABLE_APP_SCHEMES), url).toBe(false);
  }
});

// ── The mini-app shell: pinned to its app's own origins ──

const PLAYLIST = 'https://playlist.mini.skkuverse.com';
const BOOTH_BOX = 'https://booth-box.mini.skkuverse.com';
const MINIAPP_ORIGINS = {
  [PLAYLIST]: 'playlist',
  'https://playlist-cdn.mini.skkuverse.com': 'playlist',
  [BOOTH_BOX]: 'booth-box',
};
const OWN = [PLAYLIST, 'https://playlist-cdn.mini.skkuverse.com'];
const shellTop = (url: string) => decideMiniAppNavigation({ url, isTopFrame: true }, APPS, OWN);

test("a mini app's own origins are those the config maps to its id", () => {
  // Act
  const own = toMiniAppOwnOrigins(`${PLAYLIST}/setlist?x=1`, 'playlist', MINIAPP_ORIGINS);

  // Assert
  expect([...own].sort()).toStrictEqual([...OWN].sort());
});

test('a start URL on no mapped origin makes that origin the app\'s own', () => {
  // Act
  const own = toMiniAppOwnOrigins('https://student.skku.edu/student/notice2.do', 'hssc', MINIAPP_ORIGINS);

  // Assert
  expect(own).toStrictEqual(['https://student.skku.edu']);
});

test("a start URL on a sibling app's origin does not make it this app's own", () => {
  // Act
  const own = toMiniAppOwnOrigins(`${BOOTH_BOX}/`, 'playlist', MINIAPP_ORIGINS);

  // Assert
  expect(own.includes(BOOTH_BOX)).toBe(false);
});

test('with no config yet, the start URL\'s origin alone is the app\'s own', () => {
  // Act & Assert
  expect(toMiniAppOwnOrigins(`${PLAYLIST}/`, 'playlist', {})).toStrictEqual([PLAYLIST]);
});

test("the shell loads a page on any of its app's own origins", () => {
  // Act & Assert
  expect(shellTop(`${PLAYLIST}/setlist`)).toStrictEqual({ kind: 'load' });
  expect(shellTop('https://playlist-cdn.mini.skkuverse.com/a')).toStrictEqual({ kind: 'load' });
});

test('a top-frame page on another origin opens in the system browser instead', () => {
  // Act & Assert
  for (const url of ['https://evil.example/login', `${BOOTH_BOX}/`, 'http://playlist.mini.skkuverse.com/']) {
    expect(shellTop(url), url).toStrictEqual({ kind: 'open', url });
  }
});

test('an iframe on another origin still loads in place', () => {
  // Act & Assert
  expect(
    decideMiniAppNavigation({ url: 'https://www.youtube.com/embed/x', isTopFrame: false }, APPS, OWN),
  ).toStrictEqual({ kind: 'load' });
});

test('the shell decides a non-http URL as every web view does', () => {
  // Act & Assert
  for (const url of ['about:blank', 'tel:0212345678', 'kakaotalk://launch', 'javascript:alert(1)', 'supertoss://send']) {
    expect(shellTop(url), url).toStrictEqual(top(url));
  }
});

test('a request with no frame flag (Android) is not pinned, so an off-origin iframe keeps loading', () => {
  // Act
  const decision = decideMiniAppNavigation({ url: 'https://www.youtube.com/embed/x' }, APPS, OWN);

  // Assert
  expect(decision).toStrictEqual(decideNavigation({ url: 'https://www.youtube.com/embed/x' }, APPS));
});

test('a mini app with no bridged origin is not pinned', () => {
  // Act
  const decision = decideMiniAppNavigation({ url: 'https://other.example/x', isTopFrame: true }, APPS, []);

  // Assert
  expect(decision).toStrictEqual(decideNavigation({ url: 'https://other.example/x', isTopFrame: true }, APPS));
});

test("only the origins the config maps to the app's id pin it, not its start URL alone", () => {
  // Act
  const pinned = toMiniAppPinnedOrigins('https://student.skku.edu/', 'hssc', MINIAPP_ORIGINS);

  // Assert
  expect(pinned).toStrictEqual([]);
});
