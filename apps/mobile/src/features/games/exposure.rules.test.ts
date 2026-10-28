/**
 * Resolving a game id against the games registry (design D5, spec
 * games/game-host "Exposure is controlled by the registry"): every
 * combination of listed, enabled, readable and protocol. The app bundles no
 * page, so an id the registry does not list, or a registry unreachable with
 * nothing cached, opens nothing.
 */
import { describe, expect, it } from 'vitest';
import { resolveGameExposure, resolveGamePage, toGamePage, toOpenableGameIds } from './exposure.rules';
import type { GameExposure, GameRegistryEntry } from './games.types';

const HOST = 1;
const URL = 'https://apple-game.game.skkuverse.com/';

const entry = (fields: Partial<GameRegistryEntry> = {}): GameRegistryEntry => ({
  id: 'apple-game',
  entryUrl: URL,
  enabled: true,
  minHostProtocol: 1,
  ...fields,
});

describe('resolveGameExposure', () => {
  it.each<[string, readonly GameRegistryEntry[] | null, GameExposure]>([
    ['listed, enabled, supported', [entry()], { kind: 'hosted', entryUrl: URL }],
    ['listed at exactly the host protocol', [entry({ minHostProtocol: HOST })], { kind: 'hosted', entryUrl: URL }],
    ['listed but disabled', [entry({ enabled: false })], { kind: 'hidden' }],
    ['listed but too new', [entry({ minHostProtocol: HOST + 1 })], { kind: 'hidden' }],
    ['listed with an unreadable entry URL', [entry({ entryUrl: null })], { kind: 'hidden' }],
    ['listed with an unreadable protocol', [entry({ minHostProtocol: null })], { kind: 'hidden' }],
    ['not listed', [entry({ id: 'suika-game' })], { kind: 'unknown' }],
    ['an empty registry', [], { kind: 'unknown' }],
    ['registry unreachable and uncached', null, { kind: 'unknown' }],
  ])('%s', (_, index, expected) => {
    // Act
    const exposure = resolveGameExposure('apple-game', { index, hostProtocol: HOST });

    // Assert
    expect(exposure).toStrictEqual(expected);
  });

  it('reads the entry for the id asked about, whatever else is listed', () => {
    // Arrange
    const index = [
      entry({ id: 'suika-game', enabled: false }),
      entry({ id: 'apple-game' }),
      entry({ id: 'unknown-to-this-build' }),
    ];

    // Act
    const apple = resolveGameExposure('apple-game', { index, hostProtocol: HOST });
    const suika = resolveGameExposure('suika-game', { index, hostProtocol: HOST });
    const wave = resolveGameExposure('wave-run', { index, hostProtocol: HOST });

    // Assert
    expect([apple.kind, suika.kind, wave.kind]).toStrictEqual(['hosted', 'hidden', 'unknown']);
  });
});

describe('toOpenableGameIds', () => {
  const IDS = ['wave-run', 'subway-typing', 'apple-game', 'suika-game'] as const;
  const at = (id: string) => `https://${id}.game.skkuverse.com/`;
  const origins = Object.fromEntries(IDS.map((id) => [at(id).slice(0, -1), id]));
  const listed = (id: string, fields: Partial<GameRegistryEntry> = {}) => entry({ id, entryUrl: at(id), ...fields });

  it('keeps games that open in their order, and drops hidden and unknown ones', () => {
    // Arrange
    const index = [
      listed('apple-game'),
      listed('suika-game', { enabled: false }),
      listed('wave-run', { minHostProtocol: HOST + 1 }),
      listed('subway-typing'),
      listed('not-in-this-build'),
    ];

    // Act
    const ids = toOpenableGameIds(IDS, { index, hostProtocol: HOST, origins });

    // Assert
    expect(ids).toStrictEqual(['subway-typing', 'apple-game']);
  });

  it('drops a hosted game whose entry is off the origin games.origins maps to it', () => {
    // Arrange
    const index = [listed('apple-game', { entryUrl: at('suika-game') }), listed('suika-game')];

    // Act
    const ids = toOpenableGameIds(IDS, { index, hostProtocol: HOST, origins });

    // Assert
    expect(ids).toStrictEqual(['suika-game']);
  });

  it('keeps no game before the game origins are known', () => {
    // Act
    const ids = toOpenableGameIds(IDS, { index: [listed('apple-game')], hostProtocol: HOST, origins: {} });

    // Assert
    expect(ids).toStrictEqual([]);
  });

  it('keeps no game while the registry is unreachable and nothing is cached', () => {
    // Act
    const ids = toOpenableGameIds(IDS, { index: null, hostProtocol: HOST, origins });

    // Assert
    expect(ids).toStrictEqual([]);
  });
});

describe('resolveGamePage', () => {
  it('is the page toGamePage gives for the exposure, the decision a tap and a tile share', () => {
    // Arrange
    const origins = { 'https://apple-game.game.skkuverse.com': 'apple-game' };

    // Act
    const page = resolveGamePage('apple-game', { index: [entry()], hostProtocol: HOST, origins });
    const hidden = resolveGamePage('apple-game', { index: [entry({ enabled: false })], hostProtocol: HOST, origins });

    // Assert
    expect(page).toStrictEqual({ kind: 'hosted', entryUrl: URL, origin: 'https://apple-game.game.skkuverse.com' });
    expect(hidden).toBeNull();
  });
});

describe('toGamePage', () => {
  const ORIGINS = { 'https://apple-game.game.skkuverse.com': 'apple-game', 'https://suika-game.game.skkuverse.com': 'suika-game' };

  it('hosts an entry URL on the origin mapped to the id', () => {
    expect(toGamePage('apple-game', { kind: 'hosted', entryUrl: URL }, ORIGINS)).toStrictEqual({
      kind: 'hosted',
      entryUrl: URL,
      origin: 'https://apple-game.game.skkuverse.com',
    });
  });

  it.each<[string, string, GameExposure, Readonly<Record<string, string>>]>([
    ['hidden', 'apple-game', { kind: 'hidden' }, ORIGINS],
    ['unknown', 'apple-game', { kind: 'unknown' }, ORIGINS],
    ['an entry on another game\'s origin', 'apple-game', { kind: 'hosted', entryUrl: 'https://suika-game.game.skkuverse.com/' }, ORIGINS],
    ['an entry on an unmapped origin', 'apple-game', { kind: 'hosted', entryUrl: 'https://example.com/' }, ORIGINS],
    ['an entry over http', 'apple-game', { kind: 'hosted', entryUrl: 'http://apple-game.game.skkuverse.com/' }, ORIGINS],
    ['an unparseable entry', 'apple-game', { kind: 'hosted', entryUrl: 'not a url' }, ORIGINS],
    ['no game origins known yet', 'apple-game', { kind: 'hosted', entryUrl: URL }, {}],
    ['an inherited key', 'constructor', { kind: 'hosted', entryUrl: URL }, ORIGINS],
  ])('opens nothing (home) for %s', (_name, id, exposure, origins) => {
    expect(toGamePage(id, exposure, origins)).toBeNull();
  });
});
