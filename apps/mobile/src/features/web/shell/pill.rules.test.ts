import { expect, test } from 'vitest';
import type { Logo } from '@skkuverse/shared';
import { pillLabelTone, toMiniAppScreenPill } from './pill.rules';

const OWN = ['https://playlist.mini.skkuverse.com'];
const LOGO: Logo = { kind: 'emoji', emoji: '🎵' };
const pill = (currentUrl: string, name = '플레이리스트', pageTitle = 'Page title') =>
  toMiniAppScreenPill({ currentUrl, ownOrigins: OWN, name, logo: LOGO, pageTitle });

test("on the app's own origin the pill shows the registry name and logo", () => {
  // Act
  const result = pill('https://playlist.mini.skkuverse.com/setlist');

  // Assert
  expect(result.kind).toBe('app');
  expect(result.name).toBe('플레이리스트');
  expect(result.logo).toStrictEqual(LOGO);
  expect(result.faviconUri).not.toBe(null);
});

test('on its own origin with no registry name yet, the page title stands in', () => {
  // Act & Assert
  expect(pill('https://playlist.mini.skkuverse.com/', '').name).toBe('Page title');
});

test('on another origin the pill shows that host, with no logo or favicon', () => {
  // Act
  const result = pill('https://evil.example:8443/fake-playlist', '플레이리스트', '플레이리스트');

  // Assert
  expect(result).toStrictEqual({ kind: 'site', name: 'evil.example:8443', logo: null, faviconUri: null });
});

test('the same host over http is another origin', () => {
  // Act & Assert
  expect(pill('http://playlist.mini.skkuverse.com/').kind).toBe('site');
});

test('a document with no host shows no name, so no pill', () => {
  // Act & Assert
  expect(pill('about:blank')).toStrictEqual({ kind: 'site', name: '', logo: null, faviconUri: null });
  expect(pill('').name).toBe('');
});

test('on glass over a dark page, the name is white, as the status bar is', () => {
  // Act & Assert
  expect(pillLabelTone('light', true)).toBe('staticWhite');
});

test('on glass over a light page, the name keeps the neutral ink', () => {
  // Act & Assert
  expect(pillLabelTone('dark', true)).toBe('neutral');
});

test('on the solid fallback pill, the name keeps the neutral ink whatever the page', () => {
  // Act & Assert
  expect(pillLabelTone('light', false)).toBe('neutral');
});
