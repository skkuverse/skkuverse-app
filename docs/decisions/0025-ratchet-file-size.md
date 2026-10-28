---
title: Ratchet File Size per Role, Not a Cap at the Largest File
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0025. Ratchet file size per role, not a cap at the largest file

> Why the app's hooks, views and services have a size budget that lint enforces, how a file over
> it is recorded and held, and what to do when a change crosses it. Read this when `arch/file-size`
> fails, or before you change its limits.

## Status

Accepted on 2026-10-25. It revises one rejected alternative of
[ADR 0020](0020-app-architecture.md) D5, a `max-lines` cap at the largest file, which still stays
rejected. The rule runs over the backlog [ADR 0016](0016-ratchet-lint-debt-with-bulk-suppressions.md)
describes.

Amended 2026-10-28, decision 1: comment lines count, as the server's `max-lines` counts them.
[ADR 0026](0026-comments-say-only-what-the-code-cannot.md) D7 had left this open. The files the
change pushed past their record were split first, so the switch raised no count.

## Context

ADR 0020's lint rules and architecture tests check a file's shape, which is its name, its folder and what it
imports. None checks its size, and the map review of 2026-10-24 found what that leaves open:

- **A god hook grew unnoticed.** `useMapHost.ts` reached 842 lines of code and about 20 concerns.
  Every rule it was under passed, because each new concern had the right name and imported the
  right files.
- **New features went onto the biggest hook.** The hook that already held the map's state was the
  easy place to add the next piece, so it grew fastest.

ADR 0020 D5 rejected a `max-lines` cap set at the largest file, since such a cap blocks nothing a
review would let through. A cap set lower fails every large file at once, and is then disabled.

## Decision

### 1. A budget per role, counted in non-blank lines

`arch/file-size` (`scripts/eslint/plugin-arch.cjs`) counts every line that holds a token or a
comment. Only blank lines are free. A comment costs budget like the code it explains, as on the
server, so the two repositories measure a file the same way.

| Role | Budget |
| --- | --- |
| A `use*` hook, the ViewModel | `SIZE_LIMITS.hook` |
| A view, a route, a service, a client, a repository, a store or a platform wrapper | `SIZE_LIMITS.file` |
| A pure file (`.schema`, `.rules`, `.types`, `.constants`) or a `.generated` file | None |

The values are in `SIZE_LIMITS`. When chosen they were 250 and 400, each above the 95th
percentile of its role in the tree on 2026-10-25. A pure file is split by subject, not by size
(ADR 0020 D2), so it has no budget.

### 2. One report per step past the budget, recorded and held

The rule reports once for every `SIZE_STEP` lines past the budget, every report on line 1. A
report on the line where a step starts would move with every edit above it, and so would any
disable aimed at it. The value is in `SIZE_STEP`, which was 50 when chosen. The files over
budget were recorded when the rule was switched on, as ADR 0016 prescribes, so the record holds a
count of steps per file:

- **A small fix passes.** A file grows freely until it starts its next step.
- **Growth by a step fails.** The message names what to move out, such as a concern into a private hook
  in `components/`, a section into a component or a decision into a `.rules` file.
- **A file that shrinks by a step lowers its count** with `yarn lint:prune`, as every recorded rule
  does. It cannot grow back past the lower count.
- **A new file starts within its budget.** The ratchet takes no new entry for a rule that is on.

### 3. The escape is a reasoned line-level disable, and only for a file whose size is its subject

The one exception form is `// eslint-disable-line arch/file-size -- <reason>` as the file's first
line. Every report sits there, so the comment holds whatever is edited below it, and
`reportUnusedDisableDirectives` fails it once the file is back within its budget.
`sds/require-disable-reason` rejects a block or file-wide disable of an `arch/*` rule. The comment
exempts the whole file, so it is for a file whose size is its subject, such as a table, never for
a file that is merely late to be split.

Rejected:

| Alternative | Why not |
| --- | --- |
| A `max-lines` cap at the largest file | It blocks nothing a review would let through (ADR 0020 D5) |
| A hard cap with no record | Every file over it fails at once, so the cap is disabled |
| An exact line ceiling per file | Every one-line fix to a large file fails, so the record is rewritten on every edit |
| A cap on the width of a hook's return | It flagged the same files as size did, so it was one more rule with nothing new to report |
| A budget for pure files | ADR 0020 D2 splits a pure file by subject; a long table of rules on one subject is not a problem |

## Consequences

- **The recorded files are listed in `eslint-suppressions.json`**, and `yarn sds:report` prints
  the total. Each split lowers it.
- **Up to a step of growth goes unreported.** A file just under its next step can grow by one line
  only, and a file just past a step can grow by almost a whole step. The step trades precision for
  edits that do not fail on a one-line fix.
- **Comments cost budget.** A file near its limit makes a writer weigh each comment, which
  [ADR 0026](0026-comments-say-only-what-the-code-cannot.md) asks for anyway: a comment says only
  what the code cannot. `max-statements-per-line` keeps a file from joining statements onto one line
  to save budget.
- **A hook is what the file is, not what it is called.** A file named `use*`, one whose default
  export is a `use*` function, or one whose exported functions are all `use*` gets the hook budget.
- **A limit can only be loosened in place.** Raising `SIZE_LIMITS` or `SIZE_STEP` lowers counts,
  which `yarn lint:prune` records in the same commit. Lowering one adds entries, which the guard
  refuses, so a tighter limit waits until the recorded files fit it.

## Related

- [ADR 0016](0016-ratchet-lint-debt-with-bulk-suppressions.md): the record, the guard and the
  exception forms
- [ADR 0020](0020-app-architecture.md) D5: the rule list
- [Work under the lint ratchet](../how-to/work-under-the-lint-ratchet.md): the daily loop
