---
title: Replace Native Tabs With a Custom Tab Bar, Glass on iOS 26 Only
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-25
audience: internal
---

# Replace Native Tabs With a Custom Tab Bar, Glass on iOS 26 Only

> Why the app drops NativeTabs for one custom tab bar on every platform, how one map sits under two
> tabs, where glass is used, and what the switch must prove before it ships. Read this before
> touching `app/(tabs)/` or the SDS glass surfaces.

## Status

Accepted, 2026-10-23. The switch ships only after the checks in decision 5 pass.

## Context

[ADR 0022](0022-places-open-on-the-map-intents-start-in-transit.md) needs the transit and map tabs
to share one map. With NativeTabs (iOS 26+) that is practically impossible:

- Each tab is its own native screen inside a `UITabBarController`. A map mounted beneath the tab
  container would not receive touches, because the UIKit container takes them first.
- iOS NativeTabs cannot prevent a tab press (`canPreventDefault: false`), so the transit item cannot
  be turned into a mode switch inside the map tab.

Two map instances with a synced camera would work, at twice the map memory. A custom tab bar
removes the constraint instead.

## Decision

### 1. One custom tab bar on every platform

NativeTabs (iOS 26+) and the JS Tabs (iOS < 26, Android) are replaced by one tab bar built on
expo-router's headless tabs (`expo-router/ui`: `TabList`, `TabTrigger`, `TabSlot`). The routes under
`app/(tabs)/` and their deep links stay.

> [!NOTE]
> 2026-10-23, as built: the shell passes the tabs to `useTabsWithTriggers` as data
> and renders no `TabList` or `TabTrigger`. `Tabs` only finds a `TabList` that is its direct child,
> and the bar sits inside the map host (`apps/mobile/src/bootstrap/SharedMapShell.tsx`).

> [!NOTE]
> 2026-10-24: the owner first chose `expo-glass-tabs` (JavaScript only, MIT) as the tab bar, to
> adopt as it ships, and later the same day had it vendored and reworked after Instagram's bar. It
> lives in `apps/mobile/src/bootstrap/glass-tabs/` (its README names the upstream commit and every
> local change); the npm dependency is gone, so decision 4 holds with nothing new in the binary.
> The bar is icon-only, each tab with its accessibility label, and it shrinks uniformly on scroll,
> swells on press, stretches its lens with drag speed, and derives its geometry from the device.
> The icons are Phosphor, regular when idle and fill when selected, the same in both shells:
> `SquaresFour` (mini apps), `MegaphoneSimple` (notices), `MapTrifold` (map; a pin read as one
> place, not a map) and `Bus` (transit, drawn at an optical 0.86 because its glyph is about a third
> wider than the others).

The map is mounted once in the tabs layout, beneath the tab content. The map and transit tabs render
their content with `pointerEvents="box-none"` through `TabSlot`'s `renderFn`, so a touch on an empty
area reaches the map, while the sheet, the chips and the floating tab bar take their own touches.

### 2. Glass on iOS 26+ only

- **iOS 26+**: native Liquid Glass through `expo-glass-effect` on the tab bar, the sheet and the SDS
  glass surfaces, as the SDS already does behind `GLASS_AVAILABLE`.
- **iOS < 26 and Android**: the current white surfaces, no blur.
- **Reduce Transparency on iOS 26**: the white surfaces.

The tab bar follows the same rule (2026-10-24, after a same-day trial of the library's own blur on
every platform): light glass on the SDS roles on iOS 26+, and a white capsule with a shadow below
iOS 26, on Android and under Reduce Transparency. It has no dark blur.

No surface emulates glass. On Android the Naver map draws into a `SurfaceView`, which blur libraries
cannot sample, so emulated glass over the map would show a flat panel there and a blur elsewhere.
That is less consistent than plain surfaces.

### 3. What the switch drops and re-implements

- **Shrinking on scroll:** first dropped for later, then brought in by the owner (2026-10-24, an
  Instagram-style reference): the bar shrinks on scroll down and returns on scroll up. Only the
  system's own lens morph is given up for good; scrubbing across tabs is rebuilt (decision 2), and
  everything else about the bar is now ours to change.
- **Re-implemented:** the bottom inset (a tab bar height context), re-tapping a tab to scroll to top
  or pop to its root, the notices badge, accessibility (tab role, selected state, position), hiding
  the bar under the keyboard, the Android back key (it collapses a part-way sheet, then pops the
  sheet stack, and at a tab's root goes to home), the tab
  focus analytics, and iPad, which keeps the phone's bottom bar. Also the notices search and
  filter entry on iOS 26, which lives in the NativeTabs bottom accessory today (the fallback bar
  shows only without glass), and the map sheet's tab bar overlap, which is measured from the native
  tab bar's safe area.
- **Rendered at launch:** the map renders when the app starts, not on the first visit, and without
  waiting for `/map/config`.

> [!NOTE]
> 2026-10-23, as built: two of these changed after the decision.
>
> - Dragging across tabs is back. Decision 2's floating capsule ports the scrub from expo-glass-tabs
>   (MIT): the lens follows the finger, and the tab under it is selected on release. The lens morph
>   of the system bar is still not reproduced.
> - Android back at the root of every tab except home goes to home, notices included. At home's root
>   the key exits the app. The tab router's own back behaviour is `'none'` (`TAB_BACK_BEHAVIOR` in
>   `apps/mobile/src/bootstrap/tab-bar.rules.ts`), because its default sent a cold start on a map
>   tab into a back loop.

The step 1 prototype (iOS 26.5 and iOS 18.6 simulators, 2026-10-23) found two conditions without
which touches never reach the map, both traced with UIKit hit-testing:

- `TabSlot` renders with `detachInactiveScreens={false}`. The default native screen container wraps
  a `UINavigationController` whose plain UIKit views take every touch, out of reach of
  `pointerEvents`. Box-none goes in `TabSlot`'s `style`; it ignores a `pointerEvents` prop.
- The map and transit tabs have no nested Stack: their `_layout.tsx` is a `<Slot/>`. A nested
  Stack's screen takes the touch and its theme paints over the map. A full page opened from either
  tab (a timetable shuttle, taxi pooling) pushes on the root Stack.

Hidden tabs stay mounted and nothing freezes them; freezing a hidden tab, if wanted, is ours to add.
Not exercised: pinch and double-tap (the simulator tool has no multi-touch), and Android.

### 4. It ships as an OTA to 3.6.2

The switch is JavaScript only. On 2026-10-23 the 3.6.2 OTA branch and `dev` had identical
`package.json`, `yarn.lock` and `runtimeVersion`, and every module it needs (`expo-router/ui`,
`expo-glass-effect`, `react-native-reanimated`, `react-native-screens`, `@gorhom/bottom-sheet`,
`react-native-keyboard-controller`) is in the 3.6.2 binary. NativeTabs' native code stays in the
binary, unused. No `runtimeVersion` bump ([ADR 0004](0004-self-hosted-ota-fixed-runtime-version.md));
re-check the native diff if a native dependency lands before the switch.

The tab bar and the ADR 0022 map work are built together and go out in one OTA. The NativeTabs
layout and today's line screens stay in the bundle beside the new ones. One flag on `/app/config`,
cached on the device, picks the old or the new experience when the module loads, covering both the
layout and the `/bus/realtime` redirect. The server can switch every install back without a new OTA
if the release misbehaves in a way the automatic rollback does not catch.

> **Update 2026-10-25.** The server switch is removed. The owner chose to release the shared map to
> every build, and the server stops serving `features.sharedMapShell`, so the app no longer reads
> it: `decideShell` (`apps/mobile/src/bootstrap/shell.rules.ts`) runs the shared map on every
> build, prerelease and store alike. The native-tabs shell stays in the bundle only behind the
> local `SHELL_OVERRIDE`, for a developer to compare against, until it retires in a later change.
> The way back from a bad release is now the automatic rollback or a new OTA. The features the
> shared map still holds back from a store build are the gates in `PRERELEASE_GATES`
> (`apps/mobile/src/platform/ota.rules.ts`).

### 5. Proved before it ships

- During development: touches reach the map through the box-none tab content, with the real sheet
  and markers, on an iOS 26+ simulator only. No older iOS simulator and no Android emulator is used;
  the white-surface path that iOS < 26 shares with Android is seen in the owner's Android check.
- Before the release: the owner checks the release candidate on an Android device (touches through
  the tab content, the sheet and the map, startup and memory with the map rendered at launch), and
  the new shell runs on devices from an OTA test bundle before the production OTA.

If the touch check fails, ADR 0022 falls back to two map instances with a synced camera. The step 1
prototype ran on the iOS simulator with a plain list instead of the real sheet, by the owner's
choice; it lets the restructuring start, and the real-sheet check comes with step 2.

## Consequences

- A broken navigation shell breaks the whole app, and it goes out over the air: the test-bundle run
  in decision 5 is not optional. The OTA's automatic rollback covers only a crash before the first
  render; a native crash after the map mounts, an error an error boundary catches, or a screen that
  takes no touches is not rolled back. Because the shell and the map work ship in one OTA, the
  `/app/config` flag in decision 4 is the way back, not disabling the bundle; it must be tested in
  both positions before release. (2026-10-25: the flag is removed, see the update to decision 4. Both
  shells are still reachable through the local override until the native tabs retire.)
- The map and transit features must not import each other (the feature-cycle check rejects it).
  The map feature owns the map host and the place sheets; the transit feature registers its sheets
  and layers with it at load time. (2026-10-23, as built: nothing registers at load time. The
  shared-map shell composes the transit feature's view table, `TransitSheetViews`, beside the map's
  and mounts its stop feed, `TransitPlaceFeed`, inside the host. The route layers reach the transit
  tab through `/map/config` `tabs`. Transit imports the map at run time, and the map names transit
  only through `import type`, which the feature-cycle check does not count. See
  [shared-map.md](../explanation/shared-map.md#the-map-and-transit-boundary).)
- The iOS 26 chain-root rule for tab bar minimize (`docs/explanation/ios-26-native-tabs-minimize.md`
  and its CLAUDE.md section) and the native tab icon pipeline retire with NativeTabs.
- The `GLASS_AVAILABLE` branches stay: they are now the one switch between glass and white surfaces.
- The map keeps its memory while home or notices is in front. Pausing it there is a measurement for
  decision 5, not a decision yet.
- No App Store rejection for a custom tab bar or for glass on custom views was found. The HIG prefers
  system components, which this trades away.

## Related

- [ADR 0022](0022-places-open-on-the-map-intents-start-in-transit.md): what the shared map is for
- [ADR 0004](0004-self-hosted-ota-fixed-runtime-version.md): the OTA runtime rule
- `apps/mobile/src/features/map/components/canvas/MapOverlayLayer.tsx`: marker rules a pre-rendered map must keep
- [shared-map.md](../explanation/shared-map.md): the two shells, the host and the sheet stacks as built
