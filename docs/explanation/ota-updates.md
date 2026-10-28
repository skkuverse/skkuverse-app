---
title: OTA Updates
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# OTA Updates

> How the app replaces its JS bundle without a store release: what cannot travel over the air, which channel a build listens on, and how the client checks, downloads and applies an update. The maintainers publish updates from outside this repository.

## What cannot travel over the air

An update replaces the JS bundle only. Each of these needs a native rebuild and a store release:

- a change to the plugins, `ios` or `android` sections of `app.config.ts`;
- adding or removing a native module, or upgrading the Expo SDK or hot-updater;
- a change to the key the binary verifies updates with;
- a change to `version` in `app.config.ts`, which is the app version an update targets.

`version` moves with every native release, so an update built for a new binary never reaches an
old one. An update whose `version` matches no installed build reaches no device, and nothing
reports an error. [hot-updater](https://github.com/gronxb/hot-updater) is pinned exact in
`apps/mobile/package.json` and moves only together with its server side.

## Channels

`beta` reaches TestFlight and Google Play internal testing builds, and `production` the store
builds. The `@hot-updater/expo` plugin writes the channel into the binary at prebuild, from
`EAS_BUILD_PROFILE` in `app.config.ts`, and the server cannot change it. Being in TestFlight does
not make a build beta: a store build shows up there too, and it asks for `production`.

## How the app takes an update

The binary embeds a public key and installs a bundle only when every file's hash carries a valid
signature from it, and otherwise keeps running the bundle it has.
[ADR 0004](../decisions/0004-self-hosted-ota-fixed-runtime-version.md) and
[ADR 0010](../decisions/0010-hot-updater-with-kms-signing.md) record why OTA is self-hosted and
signed.

`src/bootstrap/InitGate.tsx` checks behind the custom splash on a cold start, and a found update
downloads and `HotUpdater.reload()` restarts into it. A check that outlasts `OTA_TIMEOUT_MS` lets
the app in on the bundle it has, and the update applies next time. Every return from the
background checks and downloads too, but only a return after at least `BACKGROUND_THRESHOLD_MS`
shows the splash and reloads. If a bundle crashes before its first render, hot-updater starts the
previous bundle next time and blocks the one that crashed. A failure inside an error boundary is
not a crash, so a new bundle fixes it. An update that lands before its games are listed in the
games registry hides them ([in-app-games.md](in-app-games.md)).
