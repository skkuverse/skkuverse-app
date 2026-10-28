---
title: Getting Started
type: tutorial
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Getting Started

> A guided walk from cloning on a new machine to seeing the app run in a simulator or emulator, for someone joining for the first time.

## What you need

| Tool | Version or setting | How to check |
| --- | --- | --- |
| Node.js | Whatever `.nvmrc` pins. `nvm use` matches it | `node -v` |
| Yarn | 1.x classic, which manages the workspaces | `yarn -v` |
| Xcode | For iOS, with the Command Line Tools | `xcodebuild -version` |
| JDK | 17, for Android, with `JAVA_HOME` pointing at it | `java -version` |
| Android SDK | CLI-only, with `ANDROID_HOME=~/Library/Android/sdk`. The Android Studio IDE is not needed | `echo $ANDROID_HOME` |

> [!WARNING]
> Expo Go does not work here. The app depends on custom native modules such as Firebase and Naver
> Maps, so it always runs as a real native build.

## 1. Clone and install

It is a Yarn workspaces monorepo, so one install at the root covers `apps/*` and `packages/*`.

```bash
git clone <repo-url> skkuverse-app
cd skkuverse-app
nvm use
yarn install
```

`postinstall` applies the library patches under `patches/`. The start and run scripts check that
every patch is in effect and stop if one is not; `node scripts/check-patches.mjs --fix` re-applies
them.

## 2. Set up the local files

1. **`apps/mobile/.env`.** Copy `apps/mobile/.env.example`, which explains each key. The API host
   and the public client IDs are committed in `apps/mobile/config/constants.js`, so the file holds
   only the App Check debug tokens and two optional switches.
2. **The Firebase config files**, `apps/mobile/google-services.json` and
   `apps/mobile/GoogleService-Info.plist`. They are not committed, and a full native build needs
   them, so ask a maintainer when you are invited to contribute.
3. **An App Check debug token for the iOS simulator.** A simulator cannot use App Attest, so
   `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS` in `.env` is required, and a maintainer registers the same
   UUID as a debug token for the iOS app. Without that match the token exchange fails.

## 3. First run on iOS

The app needs two terminals, both in `apps/mobile`. The first runs Metro, the JS bundler, which
listens on `127.0.0.1:8081` only, so nothing else on your network can fetch the dev bundle.

```bash
yarn start   # first terminal: leave it running
yarn ios     # second terminal
```

`yarn ios` builds natively, installs to the simulator and loads the bundle from your Metro. The
first build takes a while. A red error screen about the development server means Metro is not
running. When the simulator shows the home tab, it worked.

For a physical iPhone, start Metro with `yarn start:lan` instead. The phone reaches it over Wi-Fi,
so that Metro is open to the whole network. Stop it when you are done.

## 4. Run on Android

With `yarn start` still running, start an emulator or connect a device, then run `yarn android`
from the second terminal. An emulator reaches Metro through `10.0.2.2`. A USB device reaches it
through `adb reverse tcp:8081 tcp:8081`, which `yarn android` sets up; run it again after you
replug the device.

## 5. When you need `prebuild --clean`

JS edits hot-reload through Metro. Adding or removing a package, changing the plugins in
`app.config.ts` or changing a native module's configuration needs the native project
regenerated. When a build succeeds but a new native feature does nothing, this step was usually
skipped.

```bash
cd apps/mobile
npx expo prebuild --clean
yarn ios   # or yarn android, with yarn start running
```

## Next steps

- [ADR 0020](../decisions/0020-app-architecture.md) — the module shape inside `apps/mobile/src/`
- The root `CLAUDE.md` — the architecture, its patterns and its gotchas
- [ota-updates.md](../explanation/ota-updates.md) — how a JS-only change reaches installed apps
