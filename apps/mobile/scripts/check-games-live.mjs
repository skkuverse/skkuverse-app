// The pre-OTA games gate: the OTA publish, run from outside this repository,
// runs this before it publishes, and refuses when it fails.
//
// The app bundles no game page, so an OTA reaching players before every
// first-party game is listed, enabled and live would hide those games: no tile,
// and a link opens home. This asks production what a device would ask, `GET
// /games` and `GET /app/config` on the host every shipping build uses
// (`PROD_API_URL`), decides each game the way the device does
// (`resolveGamePage` with this build's `GAME_PROTOCOL` and `games.origins`),
// and then loads each listed `entryUrl`, which must answer 200 itself.
//
// Run with type stripping, since the ids, the exposure rule, the registry
// schema and the config parser are the app's own TypeScript:
//   node --experimental-strip-types scripts/check-games-live.mjs
// Exit 0 when every game is live, 1 otherwise (each problem printed).
import { GAME_PROTOCOL } from '@skkuverse/miniapp/protocol';
import { createRequire, register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolveGamePage } from '../src/features/games/exposure.rules.ts';

// WHY: both parsers import their zod helpers in ways strip-types cannot resolve alone.
register('./strip-types-resolve.mjs', import.meta.url);
const { parseAppConfig } = await import('../../../packages/shared/src/schema/app-config.schema.ts');
const { gameIndexSchema } = await import('../src/features/games/games.schema.ts');

const TIMEOUT_MS = 10_000;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The registry's entries by id, from a `GET /games` answer parsed by the
 * app's own schema, or a problem when the answer is not a registry: a failed
 * request, a non-200 status, or a body whose `data.games` is not a list.
 *
 * @param {{ status: number, body: unknown } | { error: string }} registry
 * @returns {{ entries: Map<string, import('../src/features/games/games.types.ts').GameRegistryEntry> } | { problem: string }}
 */
export function readRegistry(registry) {
  if ('error' in registry) return { problem: `GET /games failed: ${registry.error}` };
  if (registry.status !== 200) return { problem: `GET /games answered HTTP ${registry.status}` };
  const index = gameIndexSchema.safeParse(isObject(registry.body) ? registry.body.data : undefined);
  if (!index.success) return { problem: 'GET /games answered with no data.games list' };
  const entries = new Map();
  for (const game of index.data.games) {
    if (!entries.has(game.id)) entries.set(game.id, game);
  }
  return { entries };
}

/**
 * `games.origins` from a `GET /app/config` answer, parsed by the app's own
 * parser, or a problem when the answer is not a config.
 *
 * @param {{ status: number, body: unknown } | { error: string }} appConfig
 * @returns {{ origins: Readonly<Record<string, string>> } | { problem: string }}
 */
export function readGameOrigins(appConfig) {
  if ('error' in appConfig) return { problem: `GET /app/config failed: ${appConfig.error}` };
  if (appConfig.status !== 200) return { problem: `GET /app/config answered HTTP ${appConfig.status}` };
  if (!isObject(appConfig.body) || !isObject(appConfig.body.data)) return { problem: 'GET /app/config answered with no data' };
  return { origins: parseAppConfig(appConfig.body).games.origins };
}

/**
 * The entry URLs worth probing: those of the first-party ids the registry
 * lists as enabled.
 *
 * @param {readonly string[]} ids
 * @param {Map<string, import('../src/features/games/games.types.ts').GameRegistryEntry>} entries
 */
export function entryUrlsToProbe(ids, entries) {
  const urls = [];
  for (const id of ids) {
    const entry = entries.get(id);
    if (entry?.enabled && entry.entryUrl !== null && !urls.includes(entry.entryUrl)) {
      urls.push(entry.entryUrl);
    }
  }
  return urls;
}

/**
 * Whether the OTA may go: every first-party id listed, enabled, with an https
 * `entryUrl` that a device on `hostProtocol` would open (`minHostProtocol`
 * within it, its origin mapped to that id by `games.origins`), and that
 * answered HTTP 200 without a redirect. `problems` names each id that is not.
 *
 * @param {{
 *   ids: readonly string[],
 *   registry: { status: number, body: unknown } | { error: string },
 *   appConfig: { status: number, body: unknown } | { error: string },
 *   hostProtocol?: number,
 *   probes: Readonly<Record<string, number | { error: string }>>,
 * }} inputs
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function decideGamesLive({ ids, registry, appConfig, hostProtocol = GAME_PROTOCOL, probes }) {
  if (ids.length === 0) return { ok: false, problems: ['no first-party game ids were read from the app config'] };
  const read = readRegistry(registry);
  const config = readGameOrigins(appConfig);
  const unread = ['problem' in read && read.problem, 'problem' in config && config.problem].filter(Boolean);
  if (unread.length > 0) return { ok: false, problems: unread };
  const index = [...read.entries.values()];
  const problems = [];
  for (const id of ids) {
    const entry = read.entries.get(id);
    if (!entry) {
      problems.push(`${id}: not listed by GET /games`);
      continue;
    }
    if (!entry.enabled) {
      problems.push(`${id}: listed but not enabled`);
      continue;
    }
    const url = entry.entryUrl;
    if (url === null) {
      problems.push(`${id}: no https entryUrl`);
      continue;
    }
    const { minHostProtocol } = entry;
    if (minHostProtocol === null) {
      problems.push(`${id}: no readable minHostProtocol`);
      continue;
    }
    if (minHostProtocol > hostProtocol) {
      problems.push(`${id}: minHostProtocol ${minHostProtocol} is above this build's GAME_PROTOCOL ${hostProtocol}`);
      continue;
    }
    // Everything else the device checks passed, so a null page is the origin.
    if (resolveGamePage(id, { index, hostProtocol, origins: config.origins }) === null) {
      problems.push(`${id}: ${url} is not on the origin /app/config games.origins maps to ${id}`);
      continue;
    }
    const probe = probes[url];
    if (probe === undefined) problems.push(`${id}: ${url} was not probed`);
    else if (typeof probe !== 'number') problems.push(`${id}: ${url} failed: ${probe.error}`);
    else if (probe >= 300 && probe < 400) problems.push(`${id}: ${url} answered HTTP ${probe}, a redirect (the page itself must answer 200)`);
    else if (probe !== 200) problems.push(`${id}: ${url} answered HTTP ${probe}`);
  }
  return { ok: problems.length === 0, problems };
}

function errorText(error) {
  const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${error instanceof Error ? error.message : String(error)}${cause}`;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  } catch (error) {
    return { error: errorText(error) };
  }
}

// WHY manual: a followed redirect would report its target's status, and the
// gate is about the entryUrl the registry serves answering itself.
async function probe(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    await response.body?.cancel();
    return response.status;
  } catch (error) {
    return { error: errorText(error) };
  }
}

/** The first-party game ids, in the config's order. */
export async function loadFirstPartyGameIds() {
  const config = new URL('../src/features/games/registry.rules.ts', import.meta.url);
  const { FIRST_PARTY_GAMES } = await import(config.href);
  return Object.keys(FIRST_PARTY_GAMES);
}

async function main() {
  const require = createRequire(import.meta.url);
  const { PROD_API_URL } = require('../config/constants.js');
  const ids = await loadFirstPartyGameIds();
  const [registry, appConfig] = await Promise.all([fetchJson(`${PROD_API_URL}/games`), fetchJson(`${PROD_API_URL}/app/config`)]);
  const read = readRegistry(registry);
  const urls = 'entries' in read ? entryUrlsToProbe(ids, read.entries) : [];
  const probes = Object.fromEntries(await Promise.all(urls.map(async (url) => [url, await probe(url)])));
  const { ok, problems } = decideGamesLive({ ids, registry, appConfig, probes });
  if (ok) {
    console.log(`🎮 games live on ${PROD_API_URL}: ${ids.join(', ')}`);
    return 0;
  }
  console.error(`❌ ${PROD_API_URL} does not serve every first-party game live (protocol ${GAME_PROTOCOL}):`);
  for (const problem of problems) console.error(`   - ${problem}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
