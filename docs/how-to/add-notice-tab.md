---
title: Add a Notice Tab
type: how-to
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Add a Notice Tab

> What a new, removed or renamed notice tab needs from skkuverse-crawler, skkuverse-server and this app, in that order. Read it before touching a tab.

The app draws the tabs from `GET /notices/tabs`, so a tab appears with no app release. Most of
the work happens upstream, and a maintainer completes the release outside this repository.

## Checklist

1. **skkuverse-crawler.** Add the category to its `categories.json`, and a new source to its
   `sources.json`. That repository's procedure regenerates the files the server copies.
2. **skkuverse-server.** Its `src/notices/categories.json` is the copy it serves and builds FCM
   topics from. The schema and the checks it runs at boot are in `src/notices/notices.schema.ts`
   and `src/notices/notices.rules.ts` there. The tab takes effect with a server deploy.
3. **This app, the tab icon.** Add the tab id to `TAB_EMOJI` in
   `apps/mobile/src/features/notifications/TabToggleRow.tsx`. A missing id shows the fallback
   icon and nothing worse.
4. **This app, an Android channel, only if the tab needs its own.** Map the board label to the
   channel in `CATEGORY_CHANNELS`
   (`apps/mobile/src/bootstrap/notifications/notification-channels.rules.ts`), and create a new
   channel id in `CHANNELS` in `notifications.service.ts` beside it. The comments at both hold the
   Android quirks. This table picks the channel only for the banner the app draws in the
   foreground. A notification FCM draws takes its channel from the push, so a maintainer ships the
   same mapping on the sending side in the same release.

## Naming the tab id

The app writes a user's choices under `noticeTabEnabled.<id>` and `pickerSelections.<id>` in their
preferences document, and a picker tab's id is also its FCM topic prefix, `<id>:<sourceId>`, with
no translation between the two. `buildTopics()` in skkuverse-server
`src/notices/notices.topics.ts` builds the topics. So the id is one name across every repository,
and renaming a tab is a coordinated change, never a label edit. The `dept` tab is also a literal in
the app's code (see the notices section of `CLAUDE.md`).

## Related

- [fcm-architecture.md](../explanation/fcm-architecture.md) — the preferences document the client
  writes, and how a device receives a push
