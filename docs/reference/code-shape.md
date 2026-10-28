---
title: Code Shape Rules
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: public
---

# Code Shape Rules

> The rules for the shape of new and refactored code that lint cannot check, each under a stable ID. Read it before you write or review code in `apps/mobile` or `packages/`.

## How to read this guide

- **One home per rule.** This page holds the code-shape rules that no other document owns. Layers, folders, file names and the feature door are [ADR 0020](../decisions/0020-app-architecture.md). Comments are [ADR 0026](../decisions/0026-comments-say-only-what-the-code-cannot.md). UI tokens and components are [design-usage.md](design-usage.md). No rule is written in two of them.
- **Every rule has an ID** such as `SHAPE-01`, and its anchor is the ID in lower case (`code-shape.md#shape-01`). Review cites the ID.
- **Every rule here needs judgment** and is checked in review, by a person or an agent. When code starts to check a rule, its entry shrinks to one line that names the lint rule or test.

## Types

- <a id="shape-01"></a>**SHAPE-01** · Type a closed set as a literal union, never `string`. Derive the type from the runtime constant, as `type PrereleaseGate = (typeof PRERELEASE_GATES)[number]` in `apps/mobile/src/platform/ota.rules.ts` does. When the set already exists, import it instead of declaring it again. Narrow a value from the wire with a type guard, and never widen to `string` and cast back. A value that may be absent is `X | null`. `string` is right only for an open set, such as an id into a server dictionary or a URL. A comment that lists the values next to a `string` type means the type is wrong.

## Placement and reuse

- <a id="shape-02"></a>**SHAPE-02** · Put a file where it belongs structurally, and satisfy each lint or conventions rule on its own terms. Never pick a location because a rule exempts it. If moving a file is what makes a rule pass, the design is wrong. A shared component goes in `components/`. It holds no copy, and the feature that renders it passes its data and its words in as props.
- <a id="shape-03"></a>**SHAPE-03** · Extend a component before you duplicate it. When two components would share most of their logic and the same layout, merge them behind a discriminated-union prop. With two copies, a fix that goes into one leaves the other with the old bug.
- <a id="shape-04"></a>**SHAPE-04** · Render an auth or onboarding gate inline, as `if (gated) return <Gate />`, never as a `useEffect` that calls `router.push`. The inline branch never draws a frame of the wrong screen and leaves the navigation stack alone. The call to action also stays on screen after a modal closes. The notices tab does this with `showsOnboardingLanding` in `apps/mobile/src/features/notices/`.

## Platform

- <a id="shape-05"></a>**SHAPE-05** · Use the native API when the platform has one, and restructure the screen to fit it. The header buttons use `unstable_headerRightItems` (`apps/mobile/src/features/home/useHomeHeaderOptions.tsx`) for this reason. A JavaScript copy of a native element drifts from the system look with each OS release. Keep a JavaScript workaround only where no native path exists, and say what it cannot do in a `QUIRK` comment.
- <a id="shape-06"></a>**SHAPE-06** · Take platform chrome (tab bars, safe-area insets, hit areas, gestures) from a library that already handles it, such as the height calculation in `@react-navigation/bottom-tabs`. Name the library and its source file in a `QUIRK(<library>):` comment. Then compare the result with the native component on more than one device shape, and on Android with both gesture and three-button navigation. Never use a constant measured on one simulator, because insets differ by device and by navigation mode.

## Related

- [ADR 0020](../decisions/0020-app-architecture.md): layers, folders, file names, ViewModels, data and state
- [ADR 0026](../decisions/0026-comments-say-only-what-the-code-cannot.md): what a comment may say
- [design-usage.md](design-usage.md): when to use which token, component and pattern in the UI
- [docs/README.md](../README.md): writing rules for this folder
