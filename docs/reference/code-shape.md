---
title: Code Shape Rules
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: public
---

# Code Shape Rules

> The rules for the shape of new and refactored code that no other document owns, each under a stable ID. Read it before you write or review code in `apps/mobile` or `packages/`.

## How to read this guide

- **One home per rule.** Layers, folders, file names, ViewModels, data and state, response parsing and caching are [ADR 0020](../decisions/0020-app-architecture.md). Comments are [ADR 0026](../decisions/0026-comments-say-only-what-the-code-cannot.md). UI tokens and components are [design-usage.md](design-usage.md). This page holds the rest, and no rule is written in two of them.
- **Every rule has an ID** such as `SHAPE-01`, and its anchor is the ID in lower case (`code-shape.md#shape-01`). Review cites the ID.
- **Most rules need judgment** and are checked in review, by a person or an agent. A rule marked "not enforced yet" could be checked by code but is not yet. When a check exists, the entry shrinks to one line that names the lint rule or test.

## Types and data

- <a id="shape-01"></a>**SHAPE-01** · Type a closed set as a literal union, never `string`. Derive the type from the runtime constant, as `type PrereleaseGate = (typeof PRERELEASE_GATES)[number]` in `apps/mobile/src/platform/ota.rules.ts` does. When the set already exists, import it instead of declaring it again. `string` is right only for an open set, such as an id into a server dictionary or a URL. A comment that lists the values next to a `string` type means the type is wrong.
- <a id="shape-02"></a>**SHAPE-02** · Represent an absent or unknown value as `null`. Never use a value that could be real, such as `''`, `0`, `-1` or a placeholder string. A reader that forgets the stand-in renders it as data, so zero seats reads as full. When "this source never has it" differs from "unknown right now", give each its own state.
- <a id="shape-03"></a>**SHAPE-03** · When some fields exist only in one mode, put an explicit `kind` beside them and nest them under that mode. Never let a field's presence signal the mode, because absence cannot tell "never available" from "failed this time", and the type checker narrows only on a discriminant. Sources of different accuracy for one entity, such as an estimated vehicle and a tracked one, are separate kinds chosen per item. `Countdown` in `apps/mobile/src/features/transit/subway/countdown.rules.ts` is the pattern.
- <a id="shape-04"></a>**SHAPE-04** · Narrow a value the code did not build (a response, a stored payload, a native event, an error) with a type guard or a parse. Never use `as`, and never `as unknown as`. A cast asserts what arrived instead of checking it, so it hides an `undefined` and the fallback after it. Not enforced yet outside `.schema.ts`, where `arch/schema-cast` checks it.
- <a id="shape-05"></a>**SHAPE-05** · Read persisted data (MMKV, a persisted store, a Firestore document) as any older build may have written it. A field added later is optional on read. Each stored version migrates one step at a time, as the `migrate` in `packages/shared/src/store/settings.ts` does, and the result is parsed rather than cast.
- <a id="shape-06"></a>**SHAPE-06** · Carry a time as an instant (`arrivalAt`), and derive a countdown or a relative label from `now` where it renders, as `countdown(arrivalAt, now)` does. Never store or pass a countdown. It is wrong as soon as time passes or the app returns from the background.
- <a id="shape-07"></a>**SHAPE-07** · Treat an id that another system issues as opaque. Compare it, and never parse, slice or build it, because its format belongs to its issuer. When an external entity has an official code, key it by that code rather than an invented slug.
- <a id="shape-08"></a>**SHAPE-08** · Branch on a structured field, never on display text such as a name, a label or a provider's message. When the data lacks the field, add it at its source. Hold an entity's code in data and derive its label through one function, because text changes with wording and language.
- <a id="shape-09"></a>**SHAPE-09** · End every sort on a unique key that never changes, so tied items keep one order across fetches and renders.

## One home for each fact

- <a id="shape-10"></a>**SHAPE-10** · Give each fact one definition. Predicates, constants, parses, policies that several surfaces share and helpers for one concept such as KST dates all count. Every other site imports or derives it. When a second copy turns up, move its callers to the one definition in the same change. A copy written by hand drifts without an error, and a fix then reaches only one of them. `apps/mobile/src/features/map/sheet-detents.constants.ts`, which both map tabs read, is the pattern.
- <a id="shape-11"></a>**SHAPE-11** · Give one concept one name across the wire, deep links, types, analytics and code, and take the word from the code that already names it. Never coin a synonym or keep a table that translates between two names. A new surface reuses the vocabulary that exists for the same job, such as the `{ actionType, actionValue }` action that `handleSduiAction` in `apps/mobile/src/features/web/web.service.ts` runs.
- <a id="shape-12"></a>**SHAPE-12** · Model the members of one family (transit modes, games, sheet kinds) as one shared shape, so a new member is a data entry plus nullable fields for what it lacks. Branch only where the data really differs. Variants that behave the same go through one path and one key. What only some members need is an opt-in in the member's registry entry, as in `apps/mobile/src/features/games/registry.rules.ts`, never a fork of the shared code.
- <a id="shape-13"></a>**SHAPE-13** · Merge two steps that must always run together into one function. No caller can then apply half. A rule that says "mirror this sequence" in a new call site is the sign that the function is missing. `apps/mobile/src/platform/handoff.ts` is the pattern.

## Naming

- <a id="shape-14"></a>**SHAPE-14** · Shape a name by what it holds. A boolean starts with `is`, `has`, `can`, `needs` or `should`. A collection is a plural noun, a lookup is `<value>By<key>`, a count is `<singular>Count` and an instant is `<event>At`. A duration or a size carries its unit (`_MS`, `Ms`), and a limit is `MAX_` or `MIN_` plus what it guards. ADR 0020 D4 covers file, type and function names.
- <a id="shape-15"></a>**SHAPE-15** · Never use a generic word alone as a name: `data`, `info`, `item`, `result`, `value`, `list`, `map`, `helper`, `manager`. Add the domain noun. A one-letter name is fine only in a callback of three lines or fewer. Not enforced yet.

## Placement and reuse

- <a id="shape-16"></a>**SHAPE-16** · Put a file where it belongs structurally, and satisfy each lint or conventions rule on its own terms. Never pick a location because a rule exempts it. If moving a file is what makes a rule pass, the design is wrong. A shared component goes in `components/`. It holds no copy, and the feature that renders it passes its data and its words in as props.
- <a id="shape-17"></a>**SHAPE-17** · Extend a component before you duplicate it. When two components would share most of their logic and the same layout, merge them behind a discriminated-union prop.
- <a id="shape-18"></a>**SHAPE-18** · Lift code to a shared place, or add an interface, a door or a new kind for it, only when its second real user exists. Build the smallest mechanism the present need requires. When the next use of a slot is already decided, shape the data for it now, such as a list of items with an open `kind` (`RunAttachment` in `apps/mobile/src/features/transit/schedule/run-attachments.rules.ts`). That shape costs nothing until it is used.

## Server-owned content and trust

- <a id="shape-19"></a>**SHAPE-19** · Render what the server sends for each item (text, notes, badges, which parts appear) as it arrives. To change it, change the server. Never compose, trim or rewrite it in the client, and never branch on one item's id. A value that changes outside the app's release cycle, such as a name, an order, a line color or a schedule, comes from the server. A deliberate hardcode while no endpoint exists names when it moves.
- <a id="shape-20"></a>**SHAPE-20** · Never let a server flag choose between two code paths in the app. Keep one code path for each surface, and gate unfinished work only through `PRERELEASE_GATES`. Server data may hide content, but it never selects code.
- <a id="shape-21"></a>**SHAPE-21** · Treat the bundle as readable by anyone. It holds no secret, and it is never the only place a trust decision is made. Decide what is trusted (an origin, a path an outside link may open, a message a hosted page may send) with an exact allowlist, never a denylist, as `ALLOWED_PATHS` in `apps/mobile/src/bootstrap/deep-links/deep-links.rules.ts` does. A value that decides where data goes, such as an API host, has no default, so a missing one stops the build and names itself.
- <a id="shape-22"></a>**SHAPE-22** · Change a contract that no released build reads straight to its best shape, with no compatibility layer or versioned copy. Once a build reads it, change it in order. First make the client read both shapes and publish that update to every supported version. Then let the server switch, and delete the old reader in a change of its own.
- <a id="shape-23"></a>**SHAPE-23** · Build a screen ahead of its endpoint on a fixture in the server's exact response shape, read through the feature's real parser, as `apps/mobile/src/features/map/this-week/this-week.constants.ts` does. Going live then swaps only the source. A mock typed by hand skips the parser and hides any mismatch.

## Failures and writes

- <a id="shape-24"></a>**SHAPE-24** · Classify a failure by its cause (offline, timeout, denied, a server error) before you choose what the screen shows. A network failure offers a retry and never shows the denied state.
- <a id="shape-25"></a>**SHAPE-25** · Answer a failed write with a visible failure and a retry on the screen that made it, as `SubmitFailure` in `apps/mobile/src/features/games/host/host.rules.ts` does. Never build a queue on the device that replays it later. An SDK's own offline queue, such as Firestore's, is not this.
- <a id="shape-26"></a>**SHAPE-26** · Make a write the user triggers idempotent. A double tap or a retry on a weak network sends one request, because the code keys the request in flight, as `apps/mobile/src/features/notifications/miniapp-push.rules.ts` does.
- <a id="shape-27"></a>**SHAPE-27** · Log named fields, never a token, an email, a display name, or a raw error, request or config object. That holds in a development build too, because logs leave the device in crash reports and shared debug buffers. `apps/mobile/src/platform/dev-log.ts` is the debug buffer.

## Screens and platform

- <a id="shape-28"></a>**SHAPE-28** · Render an auth or onboarding gate inline, as `if (gated) return <Gate />`, never as a `useEffect` that calls `router.push`. The inline branch never draws a frame of the wrong screen and leaves the navigation stack alone. The call to action also stays on screen after a modal closes. The notices tab does this with `showsOnboardingLanding` in `apps/mobile/src/features/notices/`.
- <a id="shape-29"></a>**SHAPE-29** · Use the native API when the platform has one, and restructure the screen to fit it. The header buttons use `unstable_headerRightItems` (`apps/mobile/src/features/home/useHomeHeaderOptions.tsx`) for this reason. A JavaScript copy of a native element drifts from the system look with each OS release. Keep a JavaScript workaround only where no native path exists, and say what it cannot do in a `QUIRK` comment.
- <a id="shape-30"></a>**SHAPE-30** · For a mechanism outside the app's own domain, start from a maintained library or a widely used open-source project. Patch or adapt only the part you must change, and name the source in a `QUIRK(<library>):` comment. A home-made version has to rediscover the edge cases the proven one already handles. Platform chrome (tab bars, safe-area insets, hit areas, gestures) comes from a library such as `@react-navigation/bottom-tabs`, as `apps/mobile/src/bootstrap/glass-tabs/GlassTabBar.tsx` does.
- <a id="shape-31"></a>**SHAPE-31** · Compute padding, camera framing and zoom from measured sizes and the data's bounds. Never use a constant sized for the worst case, or one measured on one simulator, because insets differ by device and by Android navigation mode. A fixed correction (an offset, a clamp, a delay) goes in only with the measurement that shows it is needed, cited in an `EVIDENCE:` comment. Check chrome against the native component on more than one device shape, and on Android with both gesture and three-button navigation.
- <a id="shape-32"></a>**SHAPE-32** · Render a list whose length the data decides through a virtualized list, never a `ScrollView` over `.map()`, which mounts every row.

## Changing code

- <a id="shape-33"></a>**SHAPE-33** · Delete a component, export, switch, branch or reader in the change that leaves it unused. First show by search that nothing reads it. Never leave it switched off, or running beside its replacement, because the next reader takes it for live behavior. Not enforced yet: no unused-export check runs.
- <a id="shape-34"></a>**SHAPE-34** · Fix a defect where it starts (the server's data, the shared container, the SDS component) so every instance is fixed, and never on the screen that showed it. Never add a check keyed on the one input that failed, such as an id or a phrase. Keep that input as a test case instead. Change only what closes the diagnosed cause, and prefer a structural fix to a prop tweak that bets on a library's internals.
- <a id="shape-35"></a>**SHAPE-35** · Keep a structural change (a move, a rename, an extraction) free of behavior changes. It edits no test expectation, a file move is committed apart from its edits, and a behavior change is its own commit that says so.
- <a id="shape-36"></a>**SHAPE-36** · Write the exit next to every deferred obligation. Pins, patches, install excludes, allowlist entries, suppressions and kept legacy paths each name the condition that removes them. The pin entries in `CLAUDE.md` ("drop it at screens 4.28") are the pattern. An exception with no exit outlives its cause.

## Tests

ADR 0020 D9 sets where tests live and their shape. These rules add to it.

- <a id="shape-37"></a>**SHAPE-37** · Write the test for a behavior change or a bug fix first, and watch it fail on its assertion rather than on an import or a `TypeError`. A test that never failed proves nothing.
- <a id="shape-38"></a>**SHAPE-38** · Assert the returned value or the final state. Assert a call only when the call is the behavior, such as a navigation, a write or a send. Call assertions break on a rename and pass on a wrong result.
- <a id="shape-39"></a>**SHAPE-39** · Test a threshold at one below, at, and one above it, in a table, as `apps/mobile/src/features/transit/subway/countdown.rules.test.ts` does. Build inputs with a typed builder that takes overrides (`state(overrides)` in `apps/mobile/src/features/feedback/review-prompt.rules.test.ts`), so each test spells only the values it checks.
- <a id="shape-40"></a>**SHAPE-40** · Add no production branch, export or widened type that only a test needs. Fix a test input that disagrees with the real payload in the test, and reach internal state through the public entry point.
- <a id="shape-41"></a>**SHAPE-41** · Never edit, weaken, skip or delete a test to get green. A test leaves only in the commit that deletes the code it covers, and an expectation changes only in the commit that changes that behavior on purpose. Commit no `.only`, `.skip` or `.todo`, and give every test an assertion. Not enforced yet.
- <a id="shape-42"></a>**SHAPE-42** · Keep tests deterministic. Run them in UTC, and test KST date logic at an instant where UTC and KST fall on different days. Keep every test off the network. Not enforced yet.

## Related

- [ADR 0020](../decisions/0020-app-architecture.md): layers, folders, file names, ViewModels, data and state, tests
- [ADR 0026](../decisions/0026-comments-say-only-what-the-code-cannot.md): what a comment may say
- [design-usage.md](design-usage.md): when to use which token, component and pattern in the UI
- [docs/README.md](../README.md): writing rules for this folder
