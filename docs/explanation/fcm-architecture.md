---
title: FCM Notifications Architecture
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# FCM Notifications Architecture

> What the app writes for push notifications and what it relies on when one arrives: the intent,
> the write rules, who draws and routes a notification, and the auth transition.

## Overview

- **The stack.** `@react-native-firebase/messaging` receives every message, holds the token and
  routes taps on what FCM draws. `expo-notifications` draws the one notification the app draws
  itself, owns the Android channels and sets the iOS icon badge.
- **No inbox** ([ADR 0002](../decisions/0002-no-notification-inbox.md)). The notices tab holds the
  history, so unread is only a local counter, shown on the tab bar and mirrored onto the iOS icon.

## The principle: what is recorded is intent, what is sent is derived

The client records intent only, in `users/{uid}/preferences/main` (`PreferencesDocument` in
`packages/shared/src/store/notifications.types.ts`), the one source of truth for what a user wants.
The topics a push goes to are derived from it outside this repository, and the client never writes
the derived fields, `subscribedTopics` and `derivedAt`.

- **Every change is one `updateDoc` on dot paths, never a transaction.** Firestore queues a write
  made offline and sends it later, which keeps a toggle made in a campus Wi-Fi dead spot, while a
  transaction fails at once offline. Only a missing document is seeded whole. Each write first
  primes App Check ([app-check.md](app-check.md)).
- **MMKV holds device-local state alone**: the token, the device id and the unread count.
  Preferences come from the `onSnapshot` listener, and no local copy is treated as the source.
- **The keys of `noticeTabEnabled` and `pickerSelections` are the notice tab ids** from
  `GET /notices/tabs`, and a picker tab key is its topic prefix (`pickerSelections.dept` stands for
  `dept:<id>` topics). Adding a tab is a release across repositories
  ([add-notice-tab.md](../how-to/add-notice-tab.md)).

### The `onboardedAt` discriminator

- It is null until onboarding completes, then a timestamp, and never moves back. The default
  document leaves it null.
- The wizard opens the onboarding gate (`completeOnboarding`) only after that write succeeds, so a
  failed write leaves the device on the gate, never ahead of Firestore with no document behind it.
- A sign-in on a second device restores automatically when it reads a non-null `onboardedAt`
  (`classifyAndRestoreOnboarding` in `apps/mobile/src/features/auth/auth.service.ts`).

## On the device: display, taps and badges

| | Who displays it | Who routes the tap |
| --- | --- | --- |
| iOS, foreground | The OS, because the `setNotificationHandler` in `apps/mobile/index.ts` asks for a banner | RNFB `onNotificationOpenedApp` |
| iOS, background or quit | The OS | RNFB `onNotificationOpenedApp` or `getInitialNotification` |
| Android, foreground | The app: `onMessage` calls `scheduleNotificationAsync` on the channel `resolveNotificationChannel` picks, since FCM draws nothing in the foreground | The expo response listener, or `getLastNotificationResponse` after a cold start |
| Android, background or quit | FCM, on the payload's `channelId`, which must be the channel the app would pick | RNFB |

A push names its kind in `data.type`, and the app routes `notice` and `miniapp`
([miniapp-notification-payload.md](../reference/miniapp-notification-payload.md)). What keeps a
notification from showing, routing or counting twice is in tagged comments in
`apps/mobile/src/bootstrap/`.

## Delivery and open metrics

- **iOS delivery is reported by the Notification Service Extension**
  (`apps/mobile/targets/NotificationService/`), which iOS runs only for an alert carrying
  `mutable-content: 1`. It reads the ids it reports from the payload, so it needs neither
  `FirebaseApp.configure()` nor a `GoogleService-Info.plist`.
- **Android delivery** is exported only with
  `messaging_android_notification_delivery_metrics_export_enabled` in `apps/mobile/firebase.json`.
- **Opens depend on swizzling.** The FCM SDK logs `notification_open` and
  `notification_foreground` from the notification center delegate it takes over, so setting
  `FirebaseAppDelegateProxyEnabled` to `NO` would stop iOS opens being logged.

## Auth transitions between an anonymous and a Google uid

A device document (`devices/{deviceId}`) names its owner's uid, so it moves with every uid change.
Device registration lives in `apps/mobile/src/features/notifications/device/device.service.ts`.

- **A uid change.** `onAuthStateChanged` in `apps/mobile/src/bootstrap/useAppInit.ts` compares the
  new uid with `authStore.lastKnownUid`, which signing out never resets, and calls
  `moveDeviceToCurrentUid`, whose retries each write under the uid current when they run.
- **Signing out.** `signOutFromGoogle` calls `unregisterDevice`, which marks the document
  `active: false`, before it signs out.
- **Signing in with Google.** Every Google sign-in path goes through `signInWithDeviceMigration`
  in `apps/mobile/src/features/auth/auth.service.ts`: `unregisterDevice` first, then the sign-in,
  then `await initializeFirestoreNotifications`, which writes the device document under the new
  uid before the caller moves on. A new sign-in path follows the same order. The unregister is
  skipped only on a device that provably has no document; a null token alone is not that proof.
