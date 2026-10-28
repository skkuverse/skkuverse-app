---
title: Comments Say Only What the Code Cannot
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0026. Comments say only what the code cannot

> The rule every comment in the app's and the packages' sources follows: a tag naming why it
> exists, at most three lines, no history, no headings, no feature named in a shared layer, and
> English. It also names the checks that hold the rule. Read it before you write a comment, or
> when `node scripts/architecture/comments.mjs` reports one.

## Status

Accepted on 2026-10-27, by owner decision. It amends [ADR 0020](0020-app-architecture.md) D8. The
rule now covers every file in scope rather than migrated ones, and a JSDoc on an export needs a tag
like any other comment. This ADR also adds a checker. It ports the server's rule,
skkuverse-server `docs/decisions/0010-server-architecture.md` D10, with no exception the server
does not have.

The checks ran in report mode until the sweep brought the tree to zero on 2026-10-27. They are
enforced since then: `yarn test` (and so CI) runs the tree check, and the commit gate runs it on
the committed sources.

## Context

ADR 0020 D8 set the same tags in 2026-10, but nothing checked them, and it exempted JSDoc. On
2026-10-27 about a quarter of the non-blank lines in the app's non-test sources were comments,
against 15 % on the server after its rule. An agent reads a comment as true, while the compiler
checks a name, a constant or a type. So a comment that restates the code is the copy that goes
stale.

The server's rule was proven over its own tree before this port: it holds every comment in `src/`
to a tag, and found pointers to files that no longer existed and claims about code that no longer
held.

## Decision

### D1. A comment opens with the tag of its kind

The default is no comment. What a block does becomes a function name, what a value means becomes a
constant, a compound condition becomes an `is…` predicate, and a heading over part of a file
becomes its own file. A comment carries only what code cannot, and opens with one of these tags:

| Tag | When |
| --- | --- |
| `QUIRK(<system>):` | Behavior outside this repository the code relies on: `ios`, `android`, `naver`, `rnscreens`, the server |
| `CONTRACT(<repo>):` | Another repository that reads or writes this data, citing `<repo>/<path>` |
| `EVIDENCE:` | The measurement, incident or external limit behind a value |
| `WHY:` | A deliberate choice a reader would undo |
| `SEE: docs/<path>` | A pointer to a longer rationale; `SEE: docs/<path> ("<Heading>")` names a section |

A `CONTRACT` names only a public repository: `skkuverse`, `skkuverse-server`, `skkuverse-web`,
`skkuverse-mini`, `skkuverse-crawler` or `skkuverse-ai`. A private one has no path a reader can
open, so a comment that relies on it says `WHY:`. A `SEE:` path must exist, and a cited heading must
be a heading of that doc.

### D2. A comment says only that

A comment never states what the code does, its history, a heading, a restated signature, a list of
callers, a TODO without a tracked task, or commented-out code. It runs at most three lines; a longer
rationale goes to `docs/`, and the comment cites it with `SEE:`. A block comment, or a run of
adjacent own-line `//` comments, counts as one comment.

### D3. A shared layer names no feature

`packages/*/src`, `apps/mobile/src/platform` and `apps/mobile/src/components` do not know their
callers, so their comments name no feature. A feature is a folder under `apps/mobile/src/features`,
and counts as a folder path (`features/map/`, `../map/`), a file (`map.rules.ts`) or a hook
(`useMapHost`). A word, a component or a segment of another path does not count, so "the map",
`WebView` and an endpoint such as `/ui/home` stay allowed.

### D4. Comments are English

A comment holds no Hangul, except on a line that carries `conventions:allow-korean: <reason>`, the
marker the docs use. Product copy is a string, and no rule reads strings, so the app needs no list of
product-copy files. A Korean term quoted in a comment carries the marker too.

### D5. Scope and the comments no rule reads

The rules read the `.ts` and `.tsx` files under `apps/mobile/src`, `apps/mobile/app` and
`packages/*/src`. They skip tests (`*.test.*`, `*.typetest.*`, `__tests__/`), fixtures
(`__fixtures__/`, `__mocks__/`), declarations, `.generated.ts` files and the hash-locked files of
`.contracts.lock.json`. Test files wait for a rule of their own.

These comments are directives, not prose, and no rule reads them: the shebang, a triple-slash
reference, `@ts-expect-error <reason>`, `eslint-enable`, and an `eslint-disable` that gives its
reason after ` -- `. A bare `@ts-expect-error` or an `eslint-disable` without a reason is checked as
a comment, so it fails the tag rule.

### D6. The checks

`scripts/architecture/comments/` holds one module per rule, each with fixture tests that prove it
before it meets the tree:

| Rule | Checks |
| --- | --- |
| `comment-tags` | D1: the tag and what it cites (the `CONTRACT` repository and path, or the `SEE:` path) |
| `comment-blocks` | D2: at most three lines |
| `history-comments` | D2: no history phrase, such as "used to" or "previously" |
| `section-comments` | D2: no divider; JSX's `{/* --- X --- */}` counts, since JSX has no line comment |
| `shared-comments` | D3 |
| `english-comments` | D4 |
| `doc-paths` | D1: every `docs/…md` a comment cites exists, with the section it names |
| `route-comments` | D2: no `GET /path` restated in a `.client.ts`, whose code already names the endpoint |

The server also checks routes in its controllers. The app's analogue is the `.client.ts`, the file
that calls the endpoint; an Expo Router route file is named by its path, which no comment repeats.

`node scripts/architecture/comments.mjs --report [path...]` prints the violations by rule and
file, with the totals by rule and by area. `yarn test:comments [path...]` is the same with
`--check`, which exits 1 on any violation. `scripts/architecture/comments.test.mjs` runs the tree
check in `yarn test`, so CI's `workspace` job fails on a violation. The commit gate's `yarn
test:gate` runs `yarn test:comments` on the committed sources in scope, and over the whole tree
when a commit holds a doc under `docs/`, since a comment may cite its headings. No allowlist holds
a violation.

### D7. Decided later

- **Comments in tests** follow a tests rule, written after the sweep.
- **`arch/file-size` counts comment lines**, decided 2026-10-28 and recorded in
  [ADR 0025](0025-ratchet-file-size.md) decision 1, as the server's `max-lines` counts them.

Rejected:

| Alternative | Why not |
| --- | --- |
| Keep JSDoc on exports exempt (ADR 0020 D8) | An editor hover shows a restated signature as readily as a reason; the server holds JSDoc to a tag |
| An allowlist of today's violations | The sweep fixes them by area, and the rule turns on at zero; a list would only record debt |
| A list of product-copy files, as the server's `.conventions.json` | Korean product copy is a string here, and strings are never read |
| Allow Hangul inside a code span, as the server does | One form of exception, the marker, gives every Korean line its reason |
| A cap on the share of comment lines per file | It pushes out a needed reason as readily as a restated one (server ADR 0010 D10) |

## Consequences

- **The sweep has a number.** The report's total falls with each area batch, and a batch is done
  when its area reports zero.
- **A reason that does not fit three lines moves to a doc**, and the comment becomes `SEE:`, so the
  docs gain the rationale the code loses.
- **A Korean term in a comment costs a marker**, so a comment names the constant that holds the
  term, or says it in English, where it can.
- **The rule names stay the server's**, so a comment reads the same in either repository.

## Related

- skkuverse-server `docs/decisions/0010-server-architecture.md`, D10: the precedent
- [ADR 0020](0020-app-architecture.md) D8: the rule this amends
- [ADR 0025](0025-ratchet-file-size.md): the size budget, which counts comment lines
