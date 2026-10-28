// SEE: docs/decisions/0021-host-games-and-check-their-scores-on-the-server.md (5), docs/explanation/in-app-games.md (Opening a game)
import type { GameExposure, GamePage, GameRegistryEntry } from './games.types';

export interface ResolveGameExposureInputs {
  /** WHY: null when unreadable with nothing cached, which reads as unknown. */
  index: readonly GameRegistryEntry[] | null;
  hostProtocol: number;
}

/**
 * WHY: the app bundles no page, so the registry decides alone; disabling is the kill switch. A registry
 * entry with no first-party config is never asked about, since callers pass only configured ids.
 */
export function resolveGameExposure(id: string, { index, hostProtocol }: ResolveGameExposureInputs): GameExposure {
  const entry = index?.find((game) => game.id === id);
  if (!entry) return { kind: 'unknown' };
  const { enabled, entryUrl, minHostProtocol } = entry;
  if (!enabled || entryUrl === null || minHostProtocol === null || minHostProtocol > hostProtocol) {
    return { kind: 'hidden' };
  }
  return { kind: 'hosted', entryUrl };
}

/**
 * WHY: an `entryUrl` off the origin `games.origins` maps to `id` means two caches disagree or the config
 * is not fetched yet (the server refuses it); the host could grant that page nothing, so it does not open.
 */
export function toGamePage(id: string, exposure: GameExposure, origins: Readonly<Record<string, string>>): GamePage | null {
  if (exposure.kind !== 'hosted') return null;
  let url: URL;
  try {
    url = new URL(exposure.entryUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !Object.hasOwn(origins, url.origin) || origins[url.origin] !== id) return null;
  return { kind: 'hosted', entryUrl: exposure.entryUrl, origin: url.origin };
}

export interface ResolveGamePageInputs extends ResolveGameExposureInputs {
  origins: Readonly<Record<string, string>>;
}

/** WHY: opening and tiles both decide by it, so a tile never shows for a game a tap would not open. */
export function resolveGamePage(id: string, { origins, ...inputs }: ResolveGamePageInputs): GamePage | null {
  return toGamePage(id, resolveGameExposure(id, inputs), origins);
}

export function toOpenableGameIds<Id extends string>(ids: readonly Id[], inputs: ResolveGamePageInputs): Id[] {
  return ids.filter((id) => resolveGamePage(id, inputs) !== null);
}
