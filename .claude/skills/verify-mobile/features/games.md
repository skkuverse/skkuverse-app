# Mini games

A student opens one of the hosted mini games, which runs as a web page inside a native game screen, plays it, and sees the Hall of Fame board.

## Sub-features

- `game-link` opens a game from `skkuverse:///m/<gameId>`.
- `game-home` opens it from its tile on the home tab.
- `game-close` closes the game screen back to where it was opened.

## How to get to it (user POV)

- Tap a shared game link.
- Open the home tab (the first tab) and tap the game's tile.

## Driving it with verify-mobile

Preconditions:

- Baseline preconditions hold.
- A game the registry currently opens: `curl -s https://api.skkuverse.com/games | jq -r '.data.games[].id'`, intersected with the IDs this build knows (`FIRST_PARTY_GAMES` in `apps/mobile/src/features/games/registry.rules.ts`). `wave-run` is one.

- **Open by link.** Run `.claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///m/wave-run'`. The game screen opens over home and the game's start screen loads in it.
- **Proof.** Run `shot.sh .verify/<run-id> game-link` once the page has loaded (not the loading state).
- **Open from home.** Close the game, then tap the game's tile on the home tab (an element ref if `snapshot_ui` lists it, otherwise an AXe tap). The same game opens.
- **Close.** Use the close control (AXe tap). The previous screen shows again.

## Gotchas

- Do not play a run to its end. Finishing a run submits the score to the production board through the server. Verify the start screen, and if a change needs the end of a run, say that it was not driven.
- The page is web content: `snapshot_ui` shows it as one scroll view, so in-page buttons need AXe coordinates or `touch`.
- An ID that the registry hides or does not list opens nothing and the link lands on home. That is the intended behavior, not a broken link.
- The typing game raises the keyboard only from a tap inside the page; `type_text` then types US-keyboard keys.
