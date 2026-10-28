---
title: User Data in Firebase, Public Data in MongoDB
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0005. User data in Firebase, public data in MongoDB

## Status

Accepted — an early data architecture decision. The exact date was not recorded; this entry
was written on 2026-07-21.

## Context

The data this app handles splits cleanly in two.

**User data** is owned by one person and needs permissions: authentication state,
notification preferences, device registrations.

**Public data** reads the same for everyone and is produced by the crawler and the backend:
notices, building information, bus timetables.

The choice was whether to unify these in one store, or to let the data's nature decide
between a client that talks to the database directly and one that goes through an API.

## Decision

- **All user data lives in Firebase.** The client reads and writes Firebase Auth and
  Firestore **directly**, as with `users/{uid}/preferences/main` and `devices/{deviceId}`.
  Where server logic is needed, a Cloud Functions trigger derives it.
- **All public data lives in MongoDB.** The client never connects to that database. It reads
  through the backend API, skkuverse-server.

## Consequences

- (+) User data gets Firestore's offline queueing and realtime listeners for free, which is
  what lets a preferences write survive a campus wifi dead spot.
- (+) For public data the server acts as the caching, shaping and aggregation layer. It
  turns crawler output into a client contract such as `GET /notices/tabs`, and absorbs
  schema changes before they reach the app.
- (−) A new user-data field or collection needs a change to the server-side rules and
  functions kept outside this repository, and that change is deployed before the app change that
  writes it.
- (−) Splitting the data across two stores creates a contract mirror wherever the two meet,
  such as the server sending a notice to an FCM topic and then querying Firestore devices.
  See the [add-notice-tab runbook](../how-to/add-notice-tab.md).
- Choosing a store for a new feature costs no thought, because the test is one question:
  does this need per-user ownership and permissions? If yes, Firebase. If no, MongoDB behind
  the API.
