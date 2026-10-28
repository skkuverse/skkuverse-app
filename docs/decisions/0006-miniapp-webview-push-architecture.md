---
title: Mini App Webview & Push Architecture
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0006. Mini app webview and push architecture

> What contract a webview mini app runs on, what the app has to provide, and how backward compatibility survives for external web content that can never update in lockstep with the app.

## Status

Accepted on 2026-07-22, and implemented. Decision 3 is amended, and decision 9, an origin gate on
`/webview`, was added while building the rest. It is decision 4's trust problem with another subject.

## Context

skkuverse is adding webview mini apps that can send push. The motivation and the use cases are
recorded outside this repository. Solo development means webview only, opened to third parties in
stages: curated in phase 1, self-serve in phase 2.

The hard part is backward compatibility, not the feature. A mini app is external web content that
cannot update in lockstep with the app. When a club builds one against today's contract, it has to
keep working for users on an old build. That is a platform SDK versioning problem, and the
architecture choice is the answer to it.

The in-app browser, the `skkuverse://m/<slug>` deep link with its pending consumer, the first-party
`@skkuverse/bridge` and push tap routing already existed. This ADR connects them rather than rebuilds.

## Decision

### 1. Reuse the renderer, and split it in two

Promote the existing in-app browser to the mini-app host rather than build a new screen. That screen
was also the viewer for arbitrary links, so notice bodies and SDUI `external` targets opened in a
mini-app shell with a bookmark button and "add to home screen". Promotion therefore meant separation:

- `app/mini-app.tsx` hosts registered mini apps alone. Only the slug travels in the route.
- `app/webview.tsx` opens every other URL with minimal chrome.
- `openInAppBrowser()` is deleted, and no helper is left that could blur the two doors again.

### 2. Make the registry server-driven

The registry is served by `GET /miniapps` and `GET /miniapps/:id`, so a mini app is onboarded
without an app release. The contract discipline that comes with it:

- The schema is additive only. Do not remove a field or change what one means.
- The client ignores unknown fields, so an old build that meets a new field does not fail.
- A breaking change would need a new `version`. The client reads the payload's `version`
  (`web.schema.ts`, defaulting to 1 when absent), and nothing gates on it yet.

### 3. Host the mini-app SDK ourselves

Clubs do not bundle the SDK. They load `<script src="https://skkuverse.com/miniapp-sdk/vN.js">`, the
LIFF model, which lets skkuverse shim old app versions at the SDK level. Keeping the contract out of
the club's compiled code is the point of this choice.

> [!NOTE]
> **Amendment 2026-09-25.** First-party mini apps bundle the SDK from npm, `@skkuverse/miniapp`,
> rather than load a hosted script. The protocol's source of truth is the mini-app repository. Its
> `@skkuverse/miniapp/protocol` subpath (the message set, the shell manifest, the viewport and the
> `window.skkuverse` bootstrap) is what the shell and `miniAppDetailSchema` import, so nobody keeps a
> copy. The shimming moves into the protocol instead. A request always gets an answer
> (`unsupported` for an unknown method), and a page offers a feature only when
> `window.skkuverse.capabilities` lists it. A hosted script stays the option for third-party mini
> apps in phase 2, whose old bundles can no longer be rebuilt on demand.

### 4. Treat the native bridge as a mini-app-only channel

The shell speaks `@skkuverse/miniapp/protocol`, never `@skkuverse/bridge`, under these rules
(`capabilities.rules.ts`, `navigation.rules.ts` and `shell/`, in `apps/mobile/src/features/web/`):

- **Grant from the posting document's origin, per message.** A message is granted only when its
  origin is in `webview.bridgeOrigins` and `miniapps.origins` maps it to the shell's mini-app id. A
  sibling mini app's page, or a page on another origin the mini app navigated to, gets nothing.
- **Scope by capability.** A grant holds the mini-app methods (`NOTIFY_METHODS`) and never a
  `game.*` method. A notification outside the grant is dropped, and a request from an origin with
  no grant is answered `denied`.
- **Keep the page on its app.** On iOS, which reports the top frame, a bridged mini app's navigation
  to another origin opens in the system browser. The header shows the registry's name and logo only
  on the app's own origin and the host name elsewhere, so a page cannot borrow the app's name.
- **Install the host only on the app's origin.** The bootstrap script defines `window.skkuverse`
  only in the top window of a document on the start URL's origin, and a reply re-checks the page's
  origin before delivery.
- **Keep it separate from the first-party `@skkuverse/bridge`.** The trust boundaries differ, since
  first-party code is trusted and a third-party mini app is not. Origin and capability draw the
  boundary, not the module the code lives in.

### 5. Negotiate versions with a handshake

A mini app reads the host's protocol version and capability list from `window.skkuverse`, then
feature-detects and degrades. Sending is a no-op outside the app and on older hosts, so the contract
forbids assuming a message was handled. A mini app written for a newer SDK still runs, reduced.

### 6. Push subscription through a `miniapp:<id>` topic

A subscription is the topic `miniapp:<id>`. The user's toggle writes intent, `miniAppSelections` on
`preferences/main`, and the app writes nothing else for it. What a device receives is derived from
that intent outside this repository, as for notices.

### 7. Originate push on the server, never in a client

Push for a mini app starts on skkuverse's servers. The app receives it and routes the tap
(decision 8), and never sends, for the reason under "Alternatives rejected".

### 8. Extend tap routing

`navigateFromNotification` in `apps/mobile/src/bootstrap/notifications/notifications.service.ts`
has a `miniapp` case. It navigates home and sets `pendingMiniAppLink`, so the existing
`PendingMiniAppLinkConsumer` opens the mini app unchanged. The payload it reads is
[miniapp-notification-payload](../reference/miniapp-notification-payload.md).

### 9. An origin gate on the general-purpose `/webview`

The split in decision 1 meant that an arbitrary external page could reach `/webview` for the first
time. Until then that screen only received first-party pages, and on that assumption it handled any
message. `web:open-url` called `Linking.openURL(msg.url)`, and `web:navigate` called
`router.push(msg.path)`. Sending a notice body there broke the assumption, so the gate is a
precondition of the split rather than a follow-up to it.

- **The origin of the posting document decides the capability**, not the caller that opened the
  screen. A web view navigates, so a permission granted at open time would live on at an origin
  nobody checked. `resolveWebviewCapabilities` runs on every message.
- **The allowlist is server-owned.** `GET /app/config` serves `webview.bridgeOrigins`, since a prop
  from the caller would be a second, staler source of truth. It lists first-party origins alone. Every
  installed build trusts it, so a third-party mini app needs a field that older builds ignore.
- **A mini-app origin gets nothing in `/webview`.** `openWebView` sends its URLs to its own shell.
- **Fail closed.** No config, a failed fetch, unparseable data or an origin mismatch all grant
  nothing. `useMapConfig` falls back to defaults because a map with no campuses is broken, while a
  stale one is merely old. Failing open here would hand `Linking.openURL` to an unvetted page.
- **`web:open-url` opens what a page may hand the OS.** `openAppFirst` accepts http(s), `tel`,
  `mailto`, `sms`, `maps` and the openable app schemes (`isOpenableUrl`), and refuses the rest.
- **`web:navigate` is excluded from the grant.** No first-party page sends it. Do not revive it
  without a path allowlist.

**`web:action` asks for an action from a closed subset.** A page sends
`{ type: 'web:action', actionType, actionValue }`, the shape of a server button, so a "view on map"
button is a `map` action. It is not `web:navigate` revived, because a page gets a strict subset of
the action union, decided by `resolveWebAction` in `apps/mobile/src/features/web/web-action.rules.ts`:

| From a page | Value | Why |
| --- | --- | --- |
| `map` | `[<kind>:]<placeId>`, the `?place=` grammar | An id the app resolves itself |
| `miniapp` | `<id>[/path]`, held to that mini app's origin by the shell | An id the app resolves itself |
| `route`, `webview`, `external` | refused | Each names a destination: any screen, debug screens and `/webview?url=` included, or any URL |

Four checks can each refuse on their own: the origin gate, the payload shape in `parseWebMessage`,
the type allowlist, and each type's anchored value grammar. `/webview` injects
`window.skkuverse.bridge.actions`, which advertises and never grants, so a page shows an action button
only on a host that performs it. The shell's `map.openPlace` and `miniapp.open` use `resolveWebAction`.

## Backward-compatibility principles

These rules keep a mini-app contract alive across app versions.

- **The product is the contract, not the code.** Three contract surfaces are each versioned and
  additive only:
  1. The registry schema (`apps/mobile/src/features/web/web.schema.ts`, the payload's `version`)
  2. The mini-app SDK message set (decisions 4 and 5)
  3. The push payload and topic naming (decisions 6 and 7)
- **A host-hosted SDK** (decision 3) shims old app versions, so evolving the contract waits on no app
  release.
- **Capability negotiation** (decision 5) lets a mini app built for a newer SDK degrade on an older app.
- **The danger zone is anything bound to the app version.** Bridge handlers and tap routing are JS
  and mostly reachable by OTA, but users who never receive the OTA are the risk. Put the channel and
  the handshake into the binary early, and ship the `miniapp` tap case before any club can send. On
  an app without it the OS still shows the banner, the tap does nothing, and nothing crashes.

## Consequences

- (+) Maximum reuse. The renderer, deep links, the pending consumer, the push pipeline and the
  registry are connected rather than rebuilt.
- (+) A remote registry means onboarding without an app release.
- (−) One more cross-repo contract: the push `data` map the app routes on, set out in
  [miniapp-notification-payload](../reference/miniapp-notification-payload.md).
- (−) The origin gate and the capability set need review and upkeep once phase 2 is self-serve.

### Alternatives rejected

- **Clubs bundle the SDK.** The contract freezes at build time, so old app versions cannot be
  shimmed. Rejected as the opposite of decision 3.
- **Reuse the first-party `@skkuverse/bridge`.** The trust boundary differs, and it risks exposing
  privileged messages to code we do not trust. Separated in decision 4.
- **Let the client, the web view's JS, send push directly.** A web view is an untrusted environment,
  and send rights there allow arbitrary spam. Rejected in favour of decision 7.
