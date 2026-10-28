---
name: verify-mobile
description: Drive the Skkuverse mobile app (Expo/React Native, apps/mobile) on the iOS 26 simulator the way a user does, and capture proof that a change works. Use before calling a user-visible app change done, to reproduce a reported app bug, or when a playbook asks for the project's verification or driver skill.
---

# Verify the mobile app

The surface is the iOS app in `apps/mobile`, run as a native debug build on an iOS 26+ iPhone simulator against Metro. Android is not driven here: report Android-only behavior as "unverified, check on a device". The browser surfaces live in another repository.

Helpers live in `.claude/skills/verify-mobile/scripts/` (paths below are from the repository root). The feature map in `features/` holds one recipe per user-facing feature. Read [its index](features/README.md) before driving.

## Isolation: one instance, shared

There is one app instance per machine. The build loads its JS from `localhost:8081`, hard-coded, so two Metro servers or two simulators cannot run side by side, and other agent sessions may be using this simulator and Metro right now.

- Before you start Metro, relaunch the app or touch the simulator, check whether another agent session is driving them (if your harness lists sessions, look for a busy one working on this app). If one is, wait for it to go idle. Never drive an instance another session is using.
- Never kill a Metro you did not start. `doctor.sh` names the checkout a running Metro serves.
- Use an iOS 26+ simulator only. Do not boot older runtimes, and shut down any you booted.

## Launch

1. Dependencies: Node 22 (`.nvmrc`), then from the repository root `yarn install` and `node scripts/check-patches.mjs --fix`. The patches carry crash fixes, and a build without them proves nothing.
2. Simulator: `.claude/skills/verify-mobile/scripts/sim-udid.sh` prints the booted iOS 26 iPhone. If it fails, `xcrun simctl list devices` and `xcrun simctl boot <iOS 26 iPhone UDID>`, then `open -a Simulator`.
3. Metro: if `doctor.sh` reports no Metro, start it in the background from `apps/mobile`: `yarn start` (loopback only, port 8081). Record its PID for cleanup. Ready when `curl -s 127.0.0.1:8081/status` prints `packager-status:running`.
4. Native build, only when `doctor.sh` says the app is not installed or the change touched native code (a package, a plugin in `app.config.ts`, a patch to a native library). If `apps/mobile/ios` is missing, run `npx expo prebuild --platform ios` in `apps/mobile` first. Build in the background and wait for the marker, not for `app.app` to appear (it appears before `Info.plist` lands):

   ```bash
   cd apps/mobile && xcodebuild -workspace ios/app.xcworkspace -scheme app \
     -destination "id=$(../../.claude/skills/verify-mobile/scripts/sim-udid.sh)" \
     -derivedDataPath /tmp/verify-mobile-dd -quiet build; echo "EXIT=$?"
   xcrun simctl install "$(../../.claude/skills/verify-mobile/scripts/sim-udid.sh)" \
     /tmp/verify-mobile-dd/Build/Products/Debug-iphonesimulator/app.app
   ```

   Do not use XcodeBuildMCP `build_run_sim` for a clean build: its idle timeout kills `xcodebuild` and wedges `simctl` for minutes. A JS-only change needs no build; relaunching the app picks up Metro's bundle.
5. Launch: `perl -e 'alarm 30; exec @ARGV' xcrun simctl launch "$(.claude/skills/verify-mobile/scripts/sim-udid.sh)" com.example.skkumap`. Relaunch with `xcrun simctl terminate` first. The `alarm` matters: `simctl` can hang after the app opened iOS Settings.
6. Ready means usable: `doctor.sh` passes all five checks (the last one shows the app connected to Metro), and a screenshot shows the home tab's mini app grid, not `Loading from Metro...`, the splash or a red error box. Bundling after a relaunch takes 10 seconds to a minute; poll `doctor.sh` rather than sleeping a fixed time. A debug build may show a LogBox toast (`Open debugger to view warnings`) over the tab bar: tap its close button before driving the tabs.

## Doctor

`.claude/skills/verify-mobile/scripts/doctor.sh` is read-only and exits 1 on any failure. It checks the booted iOS 26 simulator, the installed app and the API host baked into it, that Metro on 8081 serves this checkout, that every patch is applied, and that the app is connected to Metro. Run it first, and again whenever something looks off.

The API host is baked into the build (`EXConstants.bundle`), so a debug build talks to production (`https://api.skkuverse.com`, from `apps/mobile/config/constants.js`). Editing `.env` and restarting Metro does not change it; only a rebuild does.

## Drive

Pick the entry point the feature file names. In order of preference:

- **Deep link**, for any route the app accepts from outside: `.claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///<path>'`. The accepted paths are in `apps/mobile/src/bootstrap/deep-links/deep-links.rules.ts`; anything else lands on home. A link is a real user entry point (a shared link or a notification tap), not a shortcut around one, so only count it as proof of the link path. A feature reached by a tap needs the tap too.
- **Labelled elements**: `.claude/skills/verify-mobile/scripts/ui.sh [text]` lists every element with an accessibility label and its centre point, then `axe.sh tap -x <x> -y <y>` taps it. This reaches what XcodeBuildMCP `snapshot_ui` does not: bottom sheet bodies (list rows, close buttons, tabs inside a sheet) and the map screen, where `snapshot_ui` never returns. Labels are the on-screen Korean text, so search for the text you see. Tabs are radio buttons labelled with their names.
- **Unlabelled spots**: native map markers and content inside a web view have no label. Find them on a screenshot and convert: on the iPhone 17 Pro a screenshot is 1206 px wide for 402 points, so divide pixels by 3. XcodeBuildMCP `tap`/`touch` with an element ref also work where `snapshot_ui` returns.
- **Sheet drags**: `axe.sh swipe --start-x <x> --start-y <handle y> --end-x <x> --end-y <y> --duration 0.5`, starting on the sheet handle. The MCP `swipe`/`gesture` tools move the map instead.
- **Text**: `type_text` sends US-keyboard keys only. With the Korean keyboard active, type romanized keys (`vkehxptmxm` becomes the word for wave test) to exercise Hangul composition.

Steps a person must do stay with the person: Google sign-in needs the user's password. Say which path you did not drive instead of driving a different one.

## Evidence

Put every artifact of a run under `.verify/<run-id>/` at the repository root (gitignored), with `<run-id>` like `2026-10-27-transit-line`. Cleanup never touches it.

- Screenshots: `.claude/skills/verify-mobile/scripts/shot.sh .verify/<run-id> <step-name>`, once before the action and once for the resulting state.
- Console: `node .claude/skills/verify-mobile/scripts/console.mjs 3 .verify/<run-id>/console.txt` after the drive. It replays the session's buffered console (log, warn, error). It cannot run while a React Native DevTools window holds the debugger. Object arguments print as `Object`, and warnings LogBox already showed may be missing, so treat an empty dump as no new errors, not as proof of no warnings.
- Record in `.verify/<run-id>/notes.md` the feature ID, the entry point used, the commands run, and what each screenshot shows.

Proof standards:

- Exercise the real user path: a tap, a link, a typed word. Not a store setter, a dev-only screen, or an injected state.
- Capture the action and the resulting state, not just the final screen.
- Check side effects alongside the screen. A write goes to the user's Firestore document; a read-back through a second view (relaunch, another tab) is the proof that it stuck.
- This build talks to production data. Do not submit feedback, game scores, reports or anything else that writes shared data unless the change under test is that write, and say so in the notes.
- No mocks: the app has no test mode, and nothing in this skill adds one.

## Cleanup

- Terminate the app if you launched it: `xcrun simctl terminate <udid> com.example.skkumap` (it reports `found nothing to terminate` when the app is not running, which is fine).
- Stop the Metro you started, by the PID you recorded. Never `killall node` or kill by name.
- Shut down only a simulator you booted, and only if no other session uses it.
- Remove `/tmp/verify-mobile-dd` only if you created it and need the space.
- Keep `.verify/<run-id>/`. Run cleanup after a failed attempt too, so the next attempt starts clean.

## Helpers

All in `.claude/skills/verify-mobile/scripts/`, executable, run from the repository root:

| Script | What it does |
| --- | --- |
| `doctor.sh` | Read-only readiness check, exit 1 on failure |
| `sim-udid.sh` | Prints the booted iOS 26+ iPhone UDID |
| `link.sh '<url>'` | Opens a deep link on that simulator |
| `axe.sh <args>` | Runs AXe (`tap`, `swipe`, `describe-ui`) against that simulator |
| `ui.sh [text]` | Lists labelled elements with their tap point, filtered by label text |
| `shot.sh <dir> <name>` | Saves a screenshot to `<dir>/<name>.png` |
| `console.mjs [seconds] [file]` | Dumps the app's buffered console output |
