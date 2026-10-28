---
title: Mini App Notification Payload
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Mini App Notification Payload

> The wire contract for mini-app push as a device reads it: the FCM `data` map, the Android channel,
> what a tap opens, and the subscription intent. The sender ships apart from the app, so the app's
> reading has to be right before its binary or OTA goes out. The architecture is
> [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md), decisions 6 to 8.

## The FCM `data` map

`type: 'miniapp'` is an announcement with a banner and sound. `eventmap-refresh` is retired, and the
app ignores it as it ignores any data-only message. Every value is a string, an absent optional key is
omitted rather than sent empty, and the title and body travel in the `notification` block.

| Key | Sent | What the app does with it |
| --- | --- | --- |
| `type` | always | `miniapp` |
| `miniAppId` | always | Names the sender, which a tap falls back to |
| `notificationId` | always | Names the feed entry the push announces. The app refetches the sender's feed on receipt, and once more when the entry is missing |
| `actionType`, `actionValue` | when supplied | The tap target |
| `chipId`, `placeId` | when supplied | A map destination beside the route `/campus` |

## The Android channel

A `miniapp` message carries `android.priority: 'high'` and the channel id `NotificationChannelId.MINIAPP`
(`apps/mobile/src/bootstrap/notifications/notification-channels.rules.ts`). Mini apps share one
channel because the app creates channels at startup, before it holds the registry. Android fixes a
channel's importance and sound when a device creates it, so a change in behaviour is a new id on both
sides, with the old id in `RETIRED_CHANNELS` (`notifications.service.ts`). Until an OTA creates a new
channel, FCM files the notification under its fallback channel, with no heads-up.

## What a tap opens

`resolveNotificationTap` in `apps/mobile/src/bootstrap/notifications/notification-tap.rules.ts` is
the one implementation, the same for a quit-state launch, a warm tap and an Android foreground tap.

- **`route`, `webview` and `external`** run through `handleSduiAction`, as a sheet button does. A
  `route` is exactly one of `ALLOWED_PATHS` (`bootstrap/deep-links/deep-links.rules.ts`) or the
  sender's own feed (`toFeedRoute` in `apps/mobile/src/features/web/feed/feed.constants.ts`), with no
  query. A `webview` or `external` value is `https://` with no whitespace, passes `toBrowserUrl`, and
  names no game origin (`gameIdForUrl`), both in `packages/shared/src/utils/web-url.rules.ts`.
- **`miniapp`** opens a page of a registered mini app in its shell. The value is
  `<miniAppId>[<root-relative path>]` (`parseMiniAppTarget`), the path stays on that mini app's
  origin (`resolveMiniAppUrl`), and a game id other than the sender's is refused. Prefer it over
  `webview` for a mini app's own pages, which then open under its name and badge.
- **A map destination.** Beside `route` `/campus`, a valid `chipId` (`CHIP_ID_RE`) or `placeId`
  (`parseMapPlaceRef`), each checked alone, opens on the map tab
  ([ADR 0022](../decisions/0022-places-open-on-the-map-intents-start-in-transit.md) decision 7).
- **Anything else opens the sender by id** through `pendingMiniAppLink`: no action, an unknown
  `actionType`, `content`, or a value of the wrong shape. The fallback never reads `actionValue`, so
  no uninterpreted string reaches a URL opener. The consumer looks the id up in the registry, which
  keeps the destination server data, and drops it silently when the lookup fails.

## Subscription intent

`miniAppSelections: string[]` on `preferences/main` lists the subscribed mini apps, each the topic
`miniapp:<id>`. It is independent of `categoryEnabled.notices` and gated by the master `enabled` flag.
It is no picker key, since those mirror notice categories that another repository owns.

## Compatibility rules

- `data` is additive only. Do not remove a key or change what one means. The app ignores keys it does
  not know, so a build that predates `chipId` and `placeId` routes to `/campus`.
- An app with no `miniapp` case shows the banner, and the tap does nothing. Add a tap case before any
  sender can use it. A build that predates `actionType: 'miniapp'`, or a target naming another mini
  app, opens the sender instead.
- Changing `actionType` is a payload change, not a release.
