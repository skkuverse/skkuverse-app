---
title: In-App Games
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# In-App Games

> What a first-party mini game needs from each repository before a player can open it, the order
> those changes ship in, and the trust the game screen gives a hosted page. Read it before adding a
> game or a `game.*` method. The rules worth knowing mid-session are the "In-app games" section of
> [CLAUDE.md](../../CLAUDE.md); the decision is
> [ADR 0021](../decisions/0021-host-games-and-check-their-scores-on-the-server.md).

## Opening a game

A game opens only as a page on its own origin, and only when three sources agree on its id:

| Source | Owner | What it holds for the id |
| --- | --- | --- |
| `FIRST_PARTY_GAMES` in `features/games/registry.rules.ts` | This repository | An entry, which makes the id a `GameId`. An id without one opens nothing |
| `GET /games` | skkuverse-server, its `games` dataset | An enabled entry whose `minHostProtocol` is within this host's `GAME_PROTOCOL` |
| `games.origins` in `GET /app/config` | skkuverse-server, `GAME_ID_BY_FIRST_PARTY_ORIGIN` in `src/infra/origins.ts` | The origin of the entry's https `entryUrl`, mapped to the id |

Tiles and taps decide by the same call, so home shows no game until the registry has answered
once. Every way in asks the games registry before the mini-app one, and a tap that arrives before
it has answered waits for it, with the read timeout every GET has and the cached copy as the
fallback. **Rollback** is the registry's alone: `enabled: false`, or removing the entry, hides the
game within the registry's cache lifetime and leaves its page published (ADR 0021 decision 5).

## Hosting a page on its game origin

The game screen hears and speaks to one origin, the one `games.origins` maps to the opened id.
That map is server-owned, so a new game origin grants nothing until skkuverse-server lists it, and
no mini-app list ever holds one (ADR 0021 decision 2).

- **Every message is granted by its own origin.** The posting document's origin is judged on each
  message, since the page can have navigated since it opened. Only a parsed `game.*` notification
  passes. Anything else is dropped without a word, and a request is answered `unsupported`.
- **The page side re-checks the origin.** `hostDeliverScript` does nothing unless
  `location.origin` is still the game's, and the bootstrap installs only in the top window on it.
- **Navigation is pinned to the origin.** Another site, `about:`, `data:` or the same host over
  http is refused in place and handed to nothing: a game opens no links.
- **A page asks, the host decides.** A page sends semantic notifications (a haptic style, a phase,
  a result) and never reaches a device capability. Sign-in, ads, storage and the board stay with
  the host. That is how ADR 0021 decision 8 reads App Store guideline 4.7.
- **Check a new method where it is added.** `GAME_GRANTS` takes every notification
  `@skkuverse/miniapp` defines, so check that a new `game.*` method gives a page no device
  capability before it goes into that package.

## Getting a result on the board

The app writes neither a run nor a board entry. It calls three callables, in this order, and only
reads the board:

1. **`startRun`** when a run is armed, before the first tap, with a run id the app proposes.
2. **`claimRun`** after a sign-in that changes the uid, with the anonymous account's ID token,
   before anything about the run is decided.
3. **`submitScore`** when `decideSubmit` says to, after the run's stamp has settled, with the
   scoring version the page named in `game.over`, passed through unread. A result that names none
   is not sent.

`submitSetbackOf` (`host/host.rules.ts`) maps each error code onto a submission state, and
`canRetrySubmit` beside it says which one a retry may send again.

## Adding a game

A new game is hosted from its first day.

1. **The page, in skkuverse-mini.** Scaffold it with `pnpm new --kind game <id>` and build it on
   `bootGame` until `pnpm check` and `pnpm contract` pass (its README). The id is unique across
   games and mini apps; a game replacing a web mini app keeps its id, so its `/m/<id>` link opens
   the game screen. A ranked page names its first scoring version, `<id>@1`, in `game.over`.
2. **The config, here.** Add an entry to `FIRST_PARTY_GAMES` (`leaderboard: null` for no board)
   and its overlay at `features/games/<id>/Overlay.tsx`, mapped by id in `GameOverlay.tsx`.
   Neither imports the page: a value both use is copied under a `CONTRACT(skkuverse-mini)` comment.
3. **The backend, for a ranked game.** A maintainer's step outside this repository.
4. **The registry, in skkuverse-server.** Add the origin to `GAME_ID_BY_FIRST_PARTY_ORIGIN` and
   list the game in the `games` dataset. A `{ "kind": "game", "id": "<id>" }` tile in a
   `home-layout.json` grid places it on home; a game no grid places gets the app's own grid.

## Release order

Each step is inert for installed builds until the app bundle that uses it is published, so the
order runs from the backend outward:

1. **The backend.** A new callable ships before any OTA that calls it. A scoring change is a new
   scoring version, and it ships before the page that names it is published.
2. **The page, then its listing.** Deploy the page with `pnpm ship <id>` in skkuverse-mini, then
   list it with its origin. A listed game opens on the next registry read in every build that has
   its config and speaks its `minHostProtocol`; a build without its config ignores the entry.
3. **The app bundle that carries its config.** An OTA that lands before the listing hides the
   game: no tile, and a link opens home ([ota-updates.md](ota-updates.md)).

After that, a change to the page alone is a `pnpm ship` with no app OTA. A change to its
first-party config needs an OTA, and a page change an older host cannot degrade around raises
`minHostProtocol` (ADR 0021 decision 3).

## Related

- [ADR 0021](../decisions/0021-host-games-and-check-their-scores-on-the-server.md): hosted games,
  per-kind trust, results through callables, the release path
- [miniapp-shell.md](miniapp-shell.md): the other host of `@skkuverse/miniapp`, and why it drops
  `game.*`
- [analytics.md](analytics.md): the events a game run logs
- skkuverse-server `docs/reference/games-api.md`: the games registry contract
- the mini-app repository's protocol reference: the `game.*` messages, and
  `docs/reference/miniapp-spec.md` for the game rules G1 to G4
