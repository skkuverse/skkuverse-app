---
name: sds
description: Procedures for UI work on the Skku Design System in skkuverse-app. Use when building or changing a screen or component in apps/mobile, or when adding an SDS component, part or variant in packages/sds.
---

# SDS

A router. Pick the task, read its reference, and follow it. The rules themselves are not copied
here: each reference links to where they live, so they cannot drift apart.

| Task | Read |
| --- | --- |
| Build or change a screen or an app component | [references/build-ui.md](references/build-ui.md) |
| Add an SDS component, part or variant | [references/add-component.md](references/add-component.md) |

Where the rules live, all paths from the repository root:

| What | Where |
| --- | --- |
| When to use which component, token and pattern, each rule under an ID | `docs/reference/design-usage.md` |
| How a component or token works, and the `sds/*` lint rules table | `packages/sds/SDS.md` ("Lint rules") |
| The words on screen | `docs/reference/ux-writing.md` |
| The lint record, prune, and the exception forms | `docs/how-to/work-under-the-lint-ratchet.md` |
| The decisions | `docs/decisions/0011` to `0019` |

Run every command from the repository root. A lint message's rule ID (`COLOR-01`, `PRESS-01`)
is a section of `docs/reference/design-usage.md`. Read it before deciding a fix.
