---
title: Deep Link Reference
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Deep Link Reference

> Which deep links get a `/p/` universal link, what the allowlists outside the app hold, and the
> traps a change would break. Read it before adding a path. The whitelist is the code and table test
> in `apps/mobile/src/bootstrap/deep-links/`; the routing is `deep-links.service.ts` there.

## Shared links and navigation shortcuts

| Kind | Entry | Paths |
| --- | --- | --- |
| Shared link | `skkuverse://…` and `https://skkuverse.com/p/…` | Notices (`/notices/<sourceId>/<articleNo>`) and mini apps (`/m/<target>`) |
| Navigation shortcut | `skkuverse://…` only | Every other path the filter lets through |

A path gets `/p/` and an AASA entry only when a web landing page exists for it, so a person without
the app lands somewhere. Home, campus, transit, search and the map are custom scheme only by design:
nobody sends "open the campus tab" as a web URL, and there is no page to open. Build the landing page
(served outside this repository) first and list the path second, or everyone without the app gets a
broken link. The app does not tell the kinds apart (`parseIncomingLink` strips `/p/`); only the AASA
decides whether a `/p/` link arrives.

A new variable shape is an anchored intercept that stashes its intent for a consumer after mount. A
new kind of place is a `kind` in the `place` grammar, never a new path (umbrella
`docs/decisions/0004-event-map-layer-ownership.md`, invariant 1).

## The allowlists outside the app

A universal link reaches the app only when the app claims the path and the domain allows the claim.

| Layer | Where | What it decides |
| --- | --- | --- |
| iOS | `https://skkuverse.com/.well-known/apple-app-site-association` | Which paths open the app, `NOT` exclusions included |
| Android | `https://skkuverse.com/.well-known/assetlinks.json` | Host-level authorisation (`handle_all_urls`) |
| The app's claim | `apps/mobile/app.config.ts`, `associatedDomains` and `intentFilters` | Which paths the app intercepts |

- The AASA lists the shared links alone, after its `NOT` rules. AASA takes the first match, so the
  `NOT` rules stay first. Any other `/p/` entry has no landing page and is a removal candidate.
- The Android `pathPrefix` is `/p/` with its trailing slash, for the reason beside it in
  `app.config.ts`. A change to `intentFilters` needs a prebuild and a rebuild, never an OTA.
- The iOS simulator enforces the AASA (`https://skkuverse.com/privacy` opens Safari), so where a
  universal link opens there is what the AASA says.

## Cold start and warm start

`redirectSystemPath` filters a cold start (`initial: true`) exactly as a warm one: the whitelist and
every intercept apply to both, so an untrusted link cannot push an internal route such as `/login`
or `/onboarding`, even in a single launch. They differ on bare `/` alone: cold restores the last
tab and warm goes home, for the `QUIRK` at that branch of `redirectSystemPath`.

## Mini app links are looked up after mount

`/m/<target>` is checked for shape only, and `openPendingMiniAppLink` checks the registry after
mount. `redirectSystemPath` may be async (Expo Router awaits it), but it runs before the app mounts,
outside the React tree: a lookup there would miss the shell's `QueryClient` cache and run twice, and
an offline cold start would draw nothing until it timed out. An unknown slug still ends on home and
cannot reach an internal route; the redirect home happens after the intercept instead of before.

## The authority fold: `skkuverse:` is a non-special scheme

The WHATWG URL special schemes are http, https, ws, wss, ftp and file. In any other scheme the parser
reads the first segment after `//` as an authority, so it becomes the hostname:

```text
skkuverse://map?place=x   →  hostname "map", pathname ""
skkuverse:///map?place=x  →  hostname "",    pathname "/map"
```

`parseIncomingLink` folds the host back in front of the path for this scheme alone, since an `https`
host is a real domain. It lowercases the folded host, which the parser leaves as typed, and never the
path, since a mini-app slug is case-sensitive; it reads `hostname`, since `host` carries a port; and
it parses the absolute form first, since a relative link's base host is not the link's.
`packages/shared/src/utils/__tests__/normalizeIncomingPath.test.ts` pins each case.

## Regression traps

- **Test the double-slash spelling.** When the fold breaks, `skkuverse://campus`, `//search`,
  `//m/<slug>` and `//notices/...` collapse to home together, silently, while the triple-slash
  spelling and the universal links keep working.
- **`/map/hssc` still opens the floor map.** Without the `$` in `MAP_PATH_RE` the map intercept
  swallows it, and the result looks like the campus tab opening, which does not read as a bug.
- **A notice that fails to load still routed.** A nonexistent `articleNo` pushes the detail screen,
  which then says the notice could not be loaded; for the link, that is a pass.
