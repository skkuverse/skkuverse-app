---
title: iOS Build
type: how-to
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# iOS Build

> How the build number moves in a local iOS release build (EAS Build `--local`), and the failures that build meets in this repository. A contributor runs the app with `yarn ios` instead. The maintainers make store releases from outside this repository.

The rules a release build depends on are in the Build section of the root `CLAUDE.md`:
`.easignore`, the API host and the two monorepo settings. This page holds only what that section
leaves out. The build signs with the maintainers' local credentials, which a contributor does not
have.

```bash
eas build --platform ios --profile production --local --non-interactive --output ./build.ipa
```

## The build number

`eas.json` sets `appVersionSource: "remote"` and `autoIncrement: true` on the beta and production
profiles, and both work under `--local`: EAS keeps the number and raises it before each build, so
nothing is maintained by hand. `buildNumber` in `app.config.ts` is ignored. To read the number:

```bash
eas build:version:get -p ios --non-interactive --json
```

## Troubleshooting

### GoogleService-Info.plist not found

`.easignore` is missing or excludes the file. The Firebase config files stay commented out there,
which is what includes them. `.env` stays excluded: the build needs nothing from it, and the strip
in the `extra` block of `app.config.ts` is the first defence against its debug tokens reaching an
artifact, with `.easignore` the second.

### Which API host does the artifact get?

Always `PROD_API_URL` from `apps/mobile/config/constants.js`. To confirm what a config carries
without running a build:

```bash
cd apps/mobile
EXPO_NO_DOTENV=1 EAS_BUILD_PROFILE=production npx expo config --json | jq '.extra'
```

`extra.baseUrl` should be the production host, with no `firebaseAppCheckDebugToken*` key.

### ARCHIVE FAILED with "Unable to resolve module .../apps/mobile/index.ts"

Native compile and link pass, then Xcode's "Bundle React Native code and images" phase cannot
resolve the entry. `CLAUDE.md` names the two causes and their fixes. Both are needed, since fixing
one only moves the error. What it leaves out:

- Setting `EXPO_USE_METRO_WORKSPACE_ROOT=1` does nothing, since that default is already on
  (`@expo/config/build/paths/env.js`). Only `EXPO_NO_METRO_WORKSPACE_ROOT=1` moves Metro's server
  root from the monorepo root to `apps/mobile`.
- To confirm that `experiments.autolinkingModuleResolution` still holds under that flag, run
  `expo export:embed` with the flag set and look for `Expo Autolinking module resolution enabled`
  in its output.
- The sandbox to debug in, while a build is still alive, is
  `$TMPDIR/eas-build-local-nodejs/*/build/apps/mobile`. Run `expo export:embed` there, with the
  working directory at `apps/mobile`.

## Related

- [android-build-deploy.md](android-build-deploy.md) — the Android half of the same pipeline
- [ota-updates.md](../explanation/ota-updates.md) — how the app updates its JS bundle without a
  store release
