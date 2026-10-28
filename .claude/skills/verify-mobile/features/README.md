# Skkuverse mobile verification map

This directory is the maintained source for verifying the user-facing behavior of the iOS app. Read this index before driving the app, then use the matching feature file as the recipe. The harness is the parent skill: `doctor.sh`, `link.sh`, `axe.sh`, `shot.sh` and `console.mjs` in `../scripts/`, plus the XcodeBuildMCP UI tools.

## Baseline preconditions

- `doctor.sh` passes all five checks, from this checkout.
- No other agent session is driving the simulator or Metro.
- The app runs in Korean, the simulator default. The tabs, left to right: home (mini apps), notices, map, transit. Their on-screen labels are Korean; `ui.sh` lists them.
- The user is signed out (an anonymous session) unless a recipe says otherwise.
- Data is production data, read through `https://api.skkuverse.com`. It changes: pick IDs from the live API when a recipe says so.

## Driving conventions

- Start every recipe from a fresh launch: `xcrun simctl terminate`, then `xcrun simctl launch`, then wait for the tab bar.
- Prefer a deep link or an element ref. Use AXe coordinates, read from `axe.sh describe-ui`, only where the parent skill says refs do not reach.
- A deep link proves the link path. When a feature is also reached by taps, drive the taps too, or report that entry point as not driven.
- Never write shared production data (scores, feedback, reports) unless that write is the change under test.

## Proof and skip reporting

- Evidence goes to `.verify/<run-id>/`: a screenshot before and after each action, `console.txt` from `console.mjs`, and `notes.md`.
- Record the feature ID and the entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-mobile`, `Gotchas`.

## Features

- [Transit line sheet](./transit-line.md) covers opening a bus line's sheet on the transit tab from a link and from the tab.
- [Campus map place](./campus-map.md) covers a building's detail sheet from a link and from a map tap, and the chip row.
- [Notice detail](./notice-detail.md) covers opening a notice from a shared link and backing out to the notices tab.
- [Mini games](./games.md) covers opening a hosted game from a link and from the home tab, without submitting a score.
