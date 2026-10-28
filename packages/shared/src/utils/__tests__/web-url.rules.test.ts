import { describe, expect, it } from 'vitest';
import { gameIdForUrl, toBrowserUrl } from '../web-url.rules';

describe('toBrowserUrl — what the in-app browser may load', () => {
  it.each([
    ['a notice original', 'https://www.skku.edu/skku/campus/skk_comm/notice01.do?mode=view&articleNo=1'],
    ['a first-party page', 'https://webview.skkuverse.com/skku/lostandfound'],
  ])('loads %s as it was given', (_case, url) => {
    // Act & Assert
    expect(toBrowserUrl(url)).toBe(url);
  });

  it.each([
    ['a script URL', 'javascript:alert(1)'],
    ['plain http', 'http://x.test/a'],
    ['a non-web scheme', 'itms-apps://apps.apple.com/app/id1'],
    ['a user and a password', 'https://u:p@x.test/a'],
    ['a user alone', 'https://u@x.test/a'],
    ['an empty host', 'https://'],
    ['a backslash for a host', 'https://\\'],
    ['a relative path', '/notices/cse/5847'],
    ['an empty string', ''],
    ['no value', undefined],
  ])('refuses %s', (_case, url) => {
    // Act & Assert
    expect(toBrowserUrl(url)).toBeNull();
  });

  it('decides by the parsed URL and loads that, so the check and the load agree on the host', () => {
    // Arrange
    // WHATWG reads the backslash as a slash, so this host is evil.com, and so is what loads.
    const url = 'https://\\evil.com/a';

    // Act
    const loaded = toBrowserUrl(url);

    // Assert
    expect(loaded).toBe('https://evil.com/a');
  });
});

describe('gameIdForUrl', () => {
  const APPLE = 'https://apple-game.game.skkuverse.com';
  const origins = { [APPLE]: 'apple-game' };

  it.each([
    [`${APPLE}/`, 'apple-game'],
    [`${APPLE}/deep/path?q=1#h`, 'apple-game'],
    [`${APPLE}:8443/`, null],
    ['http://apple-game.game.skkuverse.com/', null],
    ['https://apple-game.game.skkuverse.com.evil.test/', null],
    ['https://constructor/', null],
    ['not a url', null],
  ])('%s → %s', (url, expected) => {
    expect(gameIdForUrl(url, origins)).toBe(expected);
  });
});
