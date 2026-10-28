// The pre-OTA games gate's decision (check-games-live.mjs): an OTA goes only
// when production lists every first-party game enabled with a live page this
// build would open.
import { GAME_PROTOCOL } from '@skkuverse/miniapp/protocol';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideGamesLive, entryUrlsToProbe, loadFirstPartyGameIds, readGameOrigins, readRegistry } from './check-games-live.mjs';

const IDS = ['apple-game', 'suika-game'];
const url = (id) => `https://${id}.game.skkuverse.com/`;
const game = (id, fields = {}) => ({ id, entryUrl: url(id), enabled: true, minHostProtocol: 1, ...fields });
const registry = (games) => ({ status: 200, body: { meta: { lang: 'ko' }, data: { games } } });
const allLive = { [url('apple-game')]: 200, [url('suika-game')]: 200 };
const origin = (id) => `https://${id}.game.skkuverse.com`;
const appConfigWith = (origins) => ({ status: 200, body: { meta: { lang: 'ko' }, data: { games: { origins } } } });
const appConfig = appConfigWith({ [origin('apple-game')]: 'apple-game', [origin('suika-game')]: 'suika-game' });

describe('decideGamesLive', () => {
  it('lets the OTA go when every game is listed, enabled and answers 200', () => {
    const decision = decideGamesLive({ ids: IDS, appConfig, registry: registry([game('apple-game'), game('suika-game')]), probes: allLive });

    assert.deepEqual(decision, { ok: true, problems: [] });
  });

  it('refuses a game the registry does not list', () => {
    const decision = decideGamesLive({ ids: IDS, appConfig, registry: registry([game('apple-game')]), probes: allLive });

    assert.deepEqual(decision, { ok: false, problems: ['suika-game: not listed by GET /games'] });
  });

  it('refuses a disabled game', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game'), game('suika-game', { enabled: false })]),
      probes: allLive,
    });

    assert.deepEqual(decision, { ok: false, problems: ['suika-game: listed but not enabled'] });
  });

  it('refuses an enabled game without an https entryUrl', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game', { entryUrl: null }), game('suika-game', { entryUrl: 'http://suika-game.game.skkuverse.com/' })]),
      probes: allLive,
    });

    assert.deepEqual(decision.problems, ['apple-game: no https entryUrl', 'suika-game: no https entryUrl']);
  });

  it('refuses a page that answers anything but 200', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game'), game('suika-game')]),
      probes: { [url('apple-game')]: 404, [url('suika-game')]: { error: 'getaddrinfo ENOTFOUND' } },
    });

    assert.deepEqual(decision.problems, [
      `apple-game: ${url('apple-game')} answered HTTP 404`,
      `suika-game: ${url('suika-game')} failed: getaddrinfo ENOTFOUND`,
    ]);
  });

  it('refuses a game whose minHostProtocol is above this build\'s GAME_PROTOCOL', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game'), game('suika-game', { minHostProtocol: GAME_PROTOCOL + 1 })]),
      probes: allLive,
    });

    assert.deepEqual(decision.problems, [`suika-game: minHostProtocol ${GAME_PROTOCOL + 1} is above this build's GAME_PROTOCOL ${GAME_PROTOCOL}`]);
  });

  it('decides the protocol against the device\'s GAME_PROTOCOL by default, and an explicit one when given', () => {
    const inputs = { ids: IDS, appConfig, registry: registry([game('apple-game'), game('suika-game', { minHostProtocol: GAME_PROTOCOL })]), probes: allLive };

    assert.equal(decideGamesLive(inputs).ok, true);
    assert.equal(decideGamesLive({ ...inputs, hostProtocol: GAME_PROTOCOL - 1 }).ok, false);
  });

  it('refuses a game with no readable minHostProtocol', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game', { minHostProtocol: 1.5 }), game('suika-game', { minHostProtocol: null })]),
      probes: allLive,
    });

    assert.deepEqual(decision.problems, ['apple-game: no readable minHostProtocol', 'suika-game: no readable minHostProtocol']);
  });

  it('refuses an entryUrl whose origin games.origins maps to another game, or not at all', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig: appConfigWith({ [origin('apple-game')]: 'suika-game' }),
      registry: registry([game('apple-game'), game('suika-game')]),
      probes: allLive,
    });

    assert.deepEqual(decision.problems, [
      `apple-game: ${url('apple-game')} is not on the origin /app/config games.origins maps to apple-game`,
      `suika-game: ${url('suika-game')} is not on the origin /app/config games.origins maps to suika-game`,
    ]);
  });

  it('refuses a page that answers a redirect, even to a live page', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: registry([game('apple-game'), game('suika-game')]),
      probes: { [url('apple-game')]: 200, [url('suika-game')]: 301 },
    });

    assert.deepEqual(decision.problems, [`suika-game: ${url('suika-game')} answered HTTP 301, a redirect (the page itself must answer 200)`]);
  });

  it('refuses when /app/config answers an error or cannot be reached', () => {
    const base = { ids: IDS, registry: registry([game('apple-game'), game('suika-game')]), probes: allLive };

    assert.deepEqual(decideGamesLive({ ...base, appConfig: { status: 500, body: undefined } }).problems, ['GET /app/config answered HTTP 500']);
    assert.deepEqual(decideGamesLive({ ...base, appConfig: { error: 'fetch failed' } }).problems, ['GET /app/config failed: fetch failed']);
  });

  it('refuses when the registry answers an error', () => {
    const decision = decideGamesLive({
      ids: IDS,
      appConfig,
      registry: { status: 503, body: { error: { code: 'GAME_REGISTRY_UNAVAILABLE' } } },
      probes: {},
    });

    assert.deepEqual(decision, { ok: false, problems: ['GET /games answered HTTP 503'] });
  });

  it('refuses when the registry cannot be reached', () => {
    const decision = decideGamesLive({ ids: IDS, appConfig, registry: { error: 'fetch failed' }, probes: {} });

    assert.deepEqual(decision, { ok: false, problems: ['GET /games failed: fetch failed'] });
  });

  it('refuses when no ids were read, rather than passing vacuously', () => {
    const decision = decideGamesLive({ ids: [], appConfig, registry: registry([]), probes: {} });

    assert.equal(decision.ok, false);
  });
});

describe('readRegistry', () => {
  it('refuses a 200 whose body has no games list', () => {
    assert.deepEqual(readRegistry({ status: 200, body: { data: {} } }), { problem: 'GET /games answered with no data.games list' });
  });

  it('reads the entries as the app does, dropping one whose id is not a lowercase slug', () => {
    const read = readRegistry(registry([game('apple-game'), game('Suika-Game'), game('')]));

    assert.deepEqual([...read.entries.keys()], ['apple-game']);
  });
});

describe('readGameOrigins', () => {
  it('parses games.origins as the app does, dropping an origin that is not bare https', () => {
    const read = readGameOrigins(appConfigWith({ [origin('apple-game')]: 'apple-game', 'http://x.game.skkuverse.com': 'x', [`${origin('suika-game')}/`]: 'suika-game' }));

    assert.deepEqual(read, { origins: { [origin('apple-game')]: 'apple-game' } });
  });

  it('refuses a 200 with no data', () => {
    assert.deepEqual(readGameOrigins({ status: 200, body: {} }), { problem: 'GET /app/config answered with no data' });
  });
});

describe('entryUrlsToProbe', () => {
  it('probes only the enabled first-party entries', () => {
    const read = readRegistry(registry([game('apple-game'), game('suika-game', { enabled: false }), game('chess')]));

    assert.deepEqual(entryUrlsToProbe(IDS, read.entries), [url('apple-game')]);
  });
});

describe('loadFirstPartyGameIds', () => {
  it('reads the ids from the app first-party config', async () => {
    const ids = await loadFirstPartyGameIds();

    assert.ok(ids.length > 0);
    assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
  });
});
