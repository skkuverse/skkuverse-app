import { describe, it, expect } from 'vitest';
import { parseAppConfig } from '../app-config.schema';
import type { ApiEnvelope } from '../../api/types';
import production from '../__fixtures__/app-config.production.json';

/**
 * `webview.bridgeOrigins` is a SECURITY list — it decides which pages may reach
 * the native bridge from the /webview shell. Every degraded path here must
 * shrink the grant, never widen it, which is the opposite of how the rest of
 * this package falls back (useMapConfig serves defaults when the API dies).
 */

const envelope = (data: unknown): ApiEnvelope<unknown> => ({
  meta: { code: 200 },
  data,
});

const platforms = {
  ios: { minVersion: '2.0.0', updateUrl: 'https://apps.apple.com/x', minOsVersion: '16.4' },
  android: { minVersion: '2.0.0', updateUrl: null, minOsVersion: '24' },
};

describe('parseAppConfig — version gate', () => {
  it('parses the platform gates', () => {
    const cfg = parseAppConfig(envelope(platforms));
    expect(cfg.ios).toEqual(platforms.ios);
    expect(cfg.android).toEqual(platforms.android);
  });

  it('defaults a missing platform to 0.0.0 so nobody is force-updated', () => {
    const cfg = parseAppConfig(envelope({}));
    expect(cfg.ios.minVersion).toBe('0.0.0');
    expect(cfg.android.updateUrl).toBeNull();
  });

  it('reads no OS floor when the server sends none, so the app falls back to its own', () => {
    const cfg = parseAppConfig(
      envelope({ ios: { minVersion: '3.6.2' }, android: { minVersion: '3.6.2' } }),
    );
    expect(cfg.ios.minOsVersion).toBeNull();
    expect(cfg.android.minOsVersion).toBeNull();
  });

  it('reads an iOS floor as a dotted version', () => {
    for (const v of ['16', '16.4', '16.4.1', '26.0']) {
      expect(parseAppConfig(envelope({ ios: { minVersion: '3.6.2', minOsVersion: v } })).ios.minOsVersion).toBe(v);
    }
  });

  it('reads an Android floor as an API level', () => {
    for (const v of ['24', '35']) {
      expect(parseAppConfig(envelope({ android: { minVersion: '3.6.2', minOsVersion: v } })).android.minOsVersion).toBe(v);
    }
  });

  it('drops a malformed floor rather than guessing at it', () => {
    for (const minOsVersion of [16.4, 24, null, '', 'abc', '16.x', '16..4', '-1', '16.4 beta', '16.4.1.2']) {
      expect(parseAppConfig(envelope({ ios: { minVersion: '3.6.2', minOsVersion } })).ios.minOsVersion).toBeNull();
    }
    // An Android floor is an API level, never a dotted version.
    for (const minOsVersion of [24, '7.0', '24.1', '', 'API 24', '-1']) {
      expect(parseAppConfig(envelope({ android: { minVersion: '3.6.2', minOsVersion } })).android.minOsVersion).toBeNull();
    }
  });
});

describe('parseAppConfig — bridgeOrigins (fail-closed)', () => {
  it('parses a well-formed allowlist', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: { bridgeOrigins: ['https://webview.legacy.example.com'] },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual([
      'https://webview.legacy.example.com',
    ]);
  });

  it('grants nothing when the section is missing or malformed', () => {
    // An older server, a partial response, or a shape change must all mean
    // "grant nobody" — never a baked-in default list.
    for (const data of [
      { ...platforms },
      { ...platforms, webview: null },
      { ...platforms, webview: {} },
      { ...platforms, webview: { bridgeOrigins: null } },
      { ...platforms, webview: { bridgeOrigins: 'https://x.test' } },
      { ...platforms, webview: { bridgeOrigins: {} } },
      {},
      null,
    ]) {
      expect(parseAppConfig(envelope(data)).webview.bridgeOrigins).toEqual([]);
    }
  });

  it('normalizes entries to bare origins so comparison can match', () => {
    // The client compares against `new URL(pageUrl).origin`, which never has a
    // path or trailing slash. An un-normalized entry would silently never match.
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: [
            'https://a.test/',
            'https://b.test/some/path?q=1#h',
            'https://c.test:8443',
          ],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual([
      'https://a.test',
      'https://b.test',
      'https://c.test:8443',
    ]);
  });

  it('rejects non-https and unparseable entries', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: [
            'http://insecure.test',
            'javascript:alert(1)',
            'not a url',
            '',
            42,
            null,
            'https://ok.test',
          ],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual(['https://ok.test']);
  });

  it('de-duplicates entries that normalize to the same origin', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        webview: {
          bridgeOrigins: ['https://a.test', 'https://a.test/', 'https://a.test/x'],
        },
      }),
    );
    expect(cfg.webview.bridgeOrigins).toEqual(['https://a.test']);
  });
});

describe('parseAppConfig — web.origin', () => {
  it('parses a valid https origin', () => {
    const cfg = parseAppConfig(
      envelope({ ...platforms, web: { origin: 'https://skkuverse.com' } }),
    );
    expect(cfg.web.origin).toBe('https://skkuverse.com');
  });

  it('is null when absent or unusable, so callers degrade instead of guessing', () => {
    for (const web of [
      undefined,
      null,
      {},
      { origin: 42 },
      { origin: 'http://skkuverse.com' },
      { origin: 'not a url' },
    ]) {
      expect(parseAppConfig(envelope({ ...platforms, web })).web.origin).toBeNull();
    }
  });
});

describe('parseAppConfig — miniapps.origins', () => {
  it('parses origin → mini-app id', () => {
    const origins = {
      'https://eskara.miniapp.skkuverse.com': 'eskara-2026',
      'https://mukja.mini.skkuverse.com': 'mukja',
    };
    const cfg = parseAppConfig(envelope({ ...platforms, miniapps: { origins } }));
    expect(cfg.miniapps.origins).toEqual(origins);
  });

  it('is empty when absent or malformed, which leaves every URL in /webview', () => {
    for (const miniapps of [undefined, null, {}, { origins: null }, { origins: [] }, { origins: 'x' }]) {
      expect(parseAppConfig(envelope({ ...platforms, miniapps })).miniapps.origins).toEqual({});
    }
  });

  it('drops entries a page origin could never match, or whose id is not a registry id', () => {
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        miniapps: {
          origins: {
            'https://mukja.mini.skkuverse.com': 'mukja',
            'http://playlist.mini.skkuverse.com': 'playlist',
            'https://inja.mini.skkuverse.com/': 'inja',
            'https://booth-box.mini.skkuverse.com/x': 'booth-box',
            'not a url': 'eskara-2026',
            'https://a.mini.skkuverse.com': 'Bad Id',
            'https://b.mini.skkuverse.com': 42,
          },
        },
      }),
    );
    expect(cfg.miniapps.origins).toEqual({ 'https://mukja.mini.skkuverse.com': 'mukja' });
  });
});

describe('parseAppConfig — games.origins', () => {
  it('parses origin → game id', () => {
    // Arrange
    const origins = { 'https://apple-game.game.skkuverse.com': 'apple-game' };

    // Act
    const cfg = parseAppConfig(envelope({ ...platforms, games: { origins } }));

    // Assert
    expect(cfg.games.origins).toStrictEqual(origins);
  });

  it('is empty when absent or malformed, which hosts no game', () => {
    for (const games of [undefined, null, {}, { origins: null }, { origins: [] }, { origins: 'x' }]) {
      expect(parseAppConfig(envelope({ ...platforms, games })).games.origins).toStrictEqual({});
    }
  });

  it('drops entries a page origin could never match, or whose id is not a registry id', () => {
    // Act
    const cfg = parseAppConfig(
      envelope({
        ...platforms,
        games: {
          origins: {
            'https://apple-game.game.skkuverse.com': 'apple-game',
            'http://suika-game.game.skkuverse.com': 'suika-game',
            'https://wave-run.game.skkuverse.com/': 'wave-run',
            'not a url': 'subway-typing',
            'https://a.game.skkuverse.com': 'Bad Id',
            'https://b.game.skkuverse.com': 42,
          },
        },
      }),
    );

    // Assert
    expect(cfg.games.origins).toStrictEqual({ 'https://apple-game.game.skkuverse.com': 'apple-game' });
  });

  it('keeps game origins out of the mini-app map and the bridge list', () => {
    // Act
    const cfg = parseAppConfig(
      envelope({ ...platforms, games: { origins: { 'https://apple-game.game.skkuverse.com': 'apple-game' } } }),
    );

    // Assert
    expect(cfg.miniapps.origins).toStrictEqual({});
    expect(cfg.webview.bridgeOrigins).toStrictEqual([]);
  });
});

describe('parseAppConfig — the published fixture', () => {
  it('reads the production response whole', () => {
    // Act & Assert
    expect(parseAppConfig(envelope(production.data))).toMatchSnapshot();
  });
});

describe('parseAppConfig — an unreadable response', () => {
  const NO_CONFIG = {
    ios: { minVersion: '0.0.0', updateUrl: null, minOsVersion: null },
    android: { minVersion: '0.0.0', updateUrl: null, minOsVersion: null },
    webview: { bridgeOrigins: [] },
    web: { origin: null },
    miniapps: { origins: {} },
    games: { origins: {} },
  };

  it.each([undefined, null, 'x', 0, 5, true, [], [platforms], {}, { ios: 'x', android: [], webview: 5, web: true, miniapps: 'x', games: [] }])(
    'reads %j as no config, granting nothing and gating nobody',
    (data) => {
      // Act & Assert
      expect(parseAppConfig(envelope(data))).toStrictEqual(NO_CONFIG);
    },
  );

  it('gives every response its own copy of the defaults', () => {
    // Act
    const first = parseAppConfig(envelope(null));
    const second = parseAppConfig(envelope(null));

    // Assert
    expect(first.webview.bridgeOrigins).not.toBe(second.webview.bridgeOrigins);
    expect(first.games.origins).not.toBe(second.games.origins);
    expect(first.ios).not.toBe(second.ios);
  });

  it('reads a blank minVersion and updateUrl as missing, gating nobody and offering no store link', () => {
    // Act
    const blank = { minVersion: '', updateUrl: '' };
    const cfg = parseAppConfig(envelope({ ios: blank, android: blank }));

    // Assert
    expect(cfg.ios).toStrictEqual({ minVersion: '0.0.0', updateUrl: null, minOsVersion: null });
    expect(cfg.android).toStrictEqual({ minVersion: '0.0.0', updateUrl: null, minOsVersion: null });
  });

  it('reads each platform field on its own', () => {
    // Act
    const cfg = parseAppConfig(envelope({ ios: { minVersion: '', updateUrl: '' }, android: { minVersion: 3, updateUrl: 5 } }));

    // Assert
    expect(cfg.ios).toStrictEqual({ minVersion: '0.0.0', updateUrl: null, minOsVersion: null });
    expect(cfg.android).toStrictEqual({ minVersion: '0.0.0', updateUrl: null, minOsVersion: null });
  });
});

describe('parseAppConfig — origins as a URL reads them', () => {
  it('normalizes a bridge origin and a web origin the way URL does', () => {
    // Act
    const cfg = parseAppConfig(
      envelope({
        webview: { bridgeOrigins: ['https://A.TEST', 'https://b.test:443/x', ' https://c.test'] },
        web: { origin: 'https://Skkuverse.com:443/path' },
      }),
    );

    // Assert
    expect(cfg.webview.bridgeOrigins).toStrictEqual(['https://a.test', 'https://b.test', 'https://c.test']);
    expect(cfg.web.origin).toBe('https://skkuverse.com');
  });

  it('keeps an origin-map key only when it is already the bare origin URL makes of it', () => {
    // Act
    const cfg = parseAppConfig(
      envelope({
        miniapps: {
          origins: {
            'https://b.mini.skkuverse.com': 'b',
            'https://A.mini.skkuverse.com': 'a',
            'https://c.mini.skkuverse.com:443': 'c',
            'https://d.mini.skkuverse.com:8443': 'd',
            'https://e.mini.skkuverse.com': '',
            'https://f.mini.skkuverse.com': 'f_g',
            'https://a.mini.skkuverse.com': 'a',
          },
        },
      }),
    );

    // Assert
    expect(Object.entries(cfg.miniapps.origins)).toStrictEqual([
      ['https://b.mini.skkuverse.com', 'b'],
      ['https://d.mini.skkuverse.com:8443', 'd'],
      ['https://a.mini.skkuverse.com', 'a'],
    ]);
  });
});

describe('parseAppConfig — the retired features section', () => {
  it('drops a features section, so a body cached while the shell switch was served decides nothing', () => {
    // Act
    const cfg = parseAppConfig(envelope({ ...platforms, features: { sharedMapShell: false } }));

    // Assert
    expect('features' in cfg).toBe(false);
  });
});
