// CONTRACT(skkuverse-server): skkuverse-server/src/games/games.wire.ts (`gameIndex`, `gameEntry`) serves the
// registry, with fixtures under contracts/produced/fixtures/games.*.
// SEE: docs/decisions/0021-host-games-and-check-their-scores-on-the-server.md §5
import { z } from 'zod';
import { text, tolerantArray } from '@skkuverse/shared';
import type { GameRegistryEntry } from './games.types';

// WHY: `id` is the join key with the first-party config, a deep-link path and an analytics id.
const slug = text.regex(/^[a-z0-9-]+$/);
// WHY: the host loads it as a game's page; only https may be granted anything.
const httpsUrl = z.string().regex(/^https:\/\//);

/** WHY: a field that cannot be read hides the game rather than opening it, so a garbled kill switch stays shut. */
export const gameEntrySchema = z.object({
  id: slug,
  entryUrl: httpsUrl.nullable().catch(null),
  // WHY: only a literal `true` opens a listed game.
  enabled: z.boolean().catch(false),
  minHostProtocol: z.number().int().min(1).nullable().catch(null),
}) satisfies z.ZodType<GameRegistryEntry>;

/** WHY: an empty list is a real answer; a `games` that is not a list fails, so the cached copy stays. */
export const gameIndexSchema = z.object({
  games: tolerantArray(gameEntrySchema, 'games.index'),
});
