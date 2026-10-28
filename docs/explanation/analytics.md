---
title: Analytics
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Analytics

> How the app logs to Firebase Analytics (GA4) and Crashlytics, where each piece is set, and the rules a new or changed event follows. Read it before you add an event or change what one sends.

## What is sent

Everything leaves through `apps/mobile/src/platform/analytics.ts`, the only file that imports
`@react-native-firebase/analytics`. A dev build sends nothing unless
`EXPO_PUBLIC_ANALYTICS_DEBUG=1` turns it on for a DebugView session
([Checking an event](#checking-an-event)).

| Piece | Where it is set |
| --- | --- |
| Events | `track(name, params)`, typed by `EventMap` in `apps/mobile/src/platform/analytics.types.ts` and held to GA4's param limits by `sanitizeParams` in `analytics.rules.ts`. The `log*` wrappers beside `track` stay; a new event never adds one |
| Default params | `app_channel` and `ota_id` on every event, from `releaseContext` (`apps/mobile/src/platform/ota.ts`), so a behaviour can be pinned to a build and an OTA update |
| User properties | `app_channel`, `notif_perm`, `auth_state`, `preferred_campus` and `app_language`, set at launch by `apps/mobile/src/bootstrap/useAppInit.ts` (`auth_state` from its auth listener). After launch, `apps/mobile/src/bootstrap/useForegroundSync.ts` keeps `notif_perm`, `app_language` and `preferred_campus` current: on a return to the foreground, after a permission answer and on a change of campus |
| User id | The Firebase uid, from the same auth listener, cleared on sign-out |
| Screen views | From the pathname, by `SCREEN_NAMES` and `decideScreenView` (`apps/mobile/src/bootstrap/screen-names.rules.ts`), logged by `ScreenViewTracker` in `InitGate`. `screen-names.rules.test.mts` fails on a route with no name |
| Returns | `app_foreground`, from `useForegroundSync.ts`, with `bg_ms` and, when the app itself sent the user away a moment before, `handoff`. An app-made hand-off goes through the wrappers in `apps/mobile/src/platform/handoff.ts` |
| Breadcrumbs | Every event, as a Crashlytics log line `ev:<name> <id>` |
| Crash keys | `ota_id` and `app_channel`, the default params' names and values, set by `initCrashlytics` first thing in `apps/mobile/index.ts` |

### Notification permission

`notif_perm` is read with `checkPermission()` in `apps/mobile/src/platform/messaging.ts`, the check
every notification screen uses, so the property and the screens agree. It is sent only when it
changed. Expo's `getPermissionsAsync()` would not do: it tracks the requests Expo made, and the app
asks through `PermissionsAndroid`. Why Android reports only `granted` or `denied`, and why a stored
answer is never passed, are tagged at `NotifPerm` and `syncNotificationPermission`.

## Adding an event

The rules every change keeps (`track()` and `EventMap` only, `useViewTracking` for a sheet, ids
never emails or location, `markTabSwitch`, the params only the shared-map shell sends, a game's
telemetry never submitted) are in [`CLAUDE.md`](../../CLAUDE.md) ("Key Technical Details") and the
tagged comments in `apps/mobile/src/platform/analytics*.ts`. This section adds what they leave out.

Reach for the reusable events first. They exist so that a new feature needs no new event name, and
so that sources and dwell times compare across features:

| Event | For |
| --- | --- |
| `view_open` / `view_close` | A sheet, modal or hosted page. `useViewTracking(view, itemId, source)` sends the pair: the open when `itemId` turns non-null, the close with `dwell_ms` when it changes, turns null or unmounts |
| `item_action` | A deliberate action inside a view, such as opening a link or sharing |
| `link_open` | An entry from a deep link or a notification tap |

A new view, action or source is one member on `ViewName`, `ItemAction` or `EntrySource` in
`analytics.rules.ts`. When none of these fits, add a member to `EventMap` and call `track`:

- **Names are `object_action` in snake_case**, a closed set within GA4's event-name quota, never
  built from strings.
- **Log ids, not labels.** A label is translated and renamed; an id joins across both.
- **A closed set is a literal union**, never `string`.
- **Never log** an email, a nickname, an `emailPrefix`, free text the user typed about themselves,
  or the device's location. The map camera is not the user's location; the GPS fix is.

A `source` that has to cross a route, such as into a mini app's shell or the Hall of Fame, travels
as a route param and is read back with `asEntrySource`, which turns anything unknown into `other`.
A server `route` action given a source carries it as a `source` query param (`withEntrySource`), so
the screen it opens can read it. A deep link's campaign tag, `?src=<slug>`, reaches `link_open.src`
on any path: put one on a QR code or a post to tell it apart in the data.

## Game runs

A run's `game_start`, `game_end` and `game_submit` share its `play_id`, and `game_action` names it
while a run is on. `game_end` carries the page's display stats as `s_*` and its telemetry as `t_*`
(`buildGameEndParams` in `apps/mobile/src/features/games/host/host.rules.ts`). Each game computes
its telemetry in skkuverse-mini: `games/wave-run/src/game/telemetry.ts` and
`games/subway-typing/src/lib/telemetry.ts`.

## Checking an event

1. Build for the simulator with `EXPO_PUBLIC_ANALYTICS_DEBUG=1` in the environment.
2. Launch it with DebugView on:

   ```bash
   xcrun simctl launch booted com.example.skkumap -FIRDebugEnabled
   ```

3. Open **Firebase console → Analytics → DebugView** and watch the events arrive with their
   params.

## Reading the data

The recipes for reading these events, the property's console settings and the dates on which an
event changed meaning are kept outside this repository.
