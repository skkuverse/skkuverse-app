---
title: Ratchet Lint Debt with Bulk Suppressions and a Guard
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-25
audience: internal
---

# 0016. Ratchet lint debt with ESLint bulk suppressions and a guard on the record

> How a lint rule runs at error over violations that already exist: ESLint's bulk suppressions record them, a guard script keeps that record from growing, and every exception takes one of three listed forms. Read this before you switch a rule on, re-record anything, or add an exception to an `sds/*` rule.

## Status

Accepted on 2026-10-11. The plumbing is in place with no design rule switched on. The local plugin `sds` holds only its meta rule, `sds/require-disable-reason`, and `eslint-suppressions.json` does not exist yet. The first design rule creates it.

## Context

The lint rules that will enforce the design system of ADR 0011 to 0015 arrive with a backlog of existing violations in the app, in the thousands when last measured.

- **`error` blocks every edit.** Each file with a violation would fail lint until someone migrated it.
- **`warn` fails too.** `yarn lint` runs with `--max-warnings 0`, which is what keeps the tree clean of warnings today.
- **The migration is merged in batches.** Each batch needs a visual check, so the violations shrink over weeks while new code keeps arriving.

So the mechanism has to record what exists today and fail anything new. From then on the record may only shrink. The easy ways around it have to close as well: re-recording the record, and disabling a rule for a whole file or without a reason.

ESLint 9 has bulk suppressions built in. This was measured in a sandbox before the decision:

- `--suppress-rule <id>` records a count per file for that rule alone, in `eslint-suppressions.json` at the working directory.
- A file over its count fails, and ESLint prints every violation of that rule in the file.
- A count the file no longer reaches fails with exit 2 until `--prune-suppressions` lowers it.
- A file with no entry starts at zero.
- Warnings are never recorded.
- `expo lint` (the root `yarn lint`) and the Claude Code Stop gate's ESLint call both apply the record, since both run from the repository root.

## Decision

### 1. Bulk suppressions record the backlog

`eslint-suppressions.json` at the repository root holds the count per file and rule. The record is the migration's progress meter: `yarn sds:report` prints its total per rule.

Rejected:

| Alternative | Why not |
| --- | --- |
| A `/* eslint-disable */` at the top of each legacy file | A new violation in the same file passes |
| A ratchet plugin or a snapshot tool such as Betterer | A dependency for what ESLint already does |

### 2. A guard keeps the record from growing

The one hole ESLint leaves is the record itself. Running `--suppress-all` or `--suppress-rule` again writes today's violations down as the new allowance, and ESLint calls that clean. `scripts/check-suppressions-ratchet.mjs` compares the working tree's record with a base revision and fails when:

1. a count for a file and rule rose;
2. an entry for a file and rule appeared that is not a git rename of an entry that carried it (`git diff -M` against the base);
3. an entry names a file that does not exist.

A rule ID that the base record never mentions may appear, since that is how a rule is switched on. A missing record reads as empty.

| Where | Base |
| --- | --- |
| `yarn lint` and the Stop gate | `HEAD`, so the working tree may not grow past the last commit |
| CI, `workspace` job, on a push | `github.event.before`, so every pushed commit counts |
| CI, `workspace` job, on a pull request | The merge base with the target |

CI writes the rule IDs recorded for the first time and any change to the exceptions registry to the job summary, so neither lands unread.

### 3. One rule ID per concern, in a local plugin

Suppressions count per rule ID. Selectors packed into one `no-restricted-syntax` would share a count, and pruning could not tell them apart. A shared count also widens the swap hole (Consequences).

- **Each SDS concern is its own rule** in `scripts/eslint/plugin-sds.cjs`, a CommonJS module the root `eslint.config.js` requires, so it needs no package and no build. Its rules are tested with ESLint's `RuleTester` under `node --test`, in the root `yarn test:repo`.
- **The existing `no-restricted-syntax` selectors are never recorded.** They are at zero and stay there.
- **A wider import ban goes into the existing `no-restricted-imports` array.** A second `no-restricted-imports` block silently drops the first block's options, as measured.

### 4. Every rule is `error`

`warn` is never recorded and fails `--max-warnings 0` at once. A rule is either on, with a record, or off.

### 5. Every exception takes a listed form

An `sds/*` or `arch/*` rule may be switched off only by:

| Form | Where | For |
| --- | --- | --- |
| The rule's `files` scope | The rule's block in `eslint.config.js` | Whole areas the rule does not govern, such as the token definitions or the bundled game pages |
| A registry entry `{ files, rules, reason }`, `sds/*` only | `scripts/eslint/sds-exceptions.cjs`, spread into the config | A whole file outside a rule's purpose, such as a data table of route colors |
| `// eslint-disable-next-line <plugin>/<rule> -- <reason>` | The line | One line, with why |

`sds/require-disable-reason` enforces the third form. It fails a block or file-wide disable of an `sds/*` or `arch/*` rule even with a reason, a disable that names no rule, and an inline config comment that sets an `sds/*` or `arch/*` rule. It also fails any disable, of any rule, whose reason is missing or shorter than its minimum: a disable of `react-hooks/exhaustive-deps` without a reason hid why a dependency was left out (2026-10-25). `reportUnusedDisableDirectives` is set to `error` in the config, so a stale disable fails whatever `--max-warnings` is. A test fails on a registry entry whose file is gone or whose reason is empty.

A rule's report falls under the disable comments of its own file, so in the main lint pass a comment that switches the meta rule off would hide the report about that same comment. So `yarn lint` runs a second pass, `scripts/eslint/disable-guard.mjs`, right after the main one:

- **The meta rule alone, with inline config off.** No disable or inline config comment can silence it. Every other rule is off in this pass, since with inline config off a legitimate disable of any other rule would stop holding.
- **Through ESLint's Node API**, which in ESLint 9 does not apply `eslint-suppressions.json`, so recording the meta rule cannot silence it either.
- **Over the root config's own files, parsers and ignores.** Each block keeps everything but its rules.

`yarn sds:exceptions` lists every disable comment with its reason, every registry entry and the recorded debt, each labelled as an exception or as debt.

### 6. Switching a rule on records that rule alone, without `--fix`

The commit that switches a rule on adds the rule at `error` and records it with `eslint . --no-cache --suppress-rule sds/<id>`, config and record together.

- **Never `--suppress-all`.** It records the errors of every other rule present at that moment.
- **Never `--fix`.** ESLint's suppressions guide pairs the two, but several SDS rules are autofixable, and fixing at record time would land every visual change at once with no screenshot check. The migration batches make those changes, one batch at a time.
- **`--no-cache`**, because a cached result can be stale for a rule that looks across files.

## Consequences

- **A fixed violation shrinks the record in the same change.** Lint fails with exit 2 until `yarn lint:prune` lowers the count, so the record always matches the code.
- **The swap hole stays open.** Fixing one violation and adding another of the same rule in the same file keeps the count, and passes. Narrow rule IDs keep it small, and per-violation fingerprints were judged not worth their cost.
- **Editors show recorded violations as errors.** ESLint 9's Node API does not apply suppressions, so the editor integration reports what the CLI lets through. ESLint 10 adds `applySuppressions`, and upgrading is a separate decision.
- **A rename must go through `git mv`.** The guard sees a rename only when git does. Locally that means a staged rename, and an unstaged move reads as a new entry, which the message points out. CI compares commits and always sees it.
- **Bash-run codemods bypass the Stop gate**, which runs on files a turn edited through its tools. The migration batches end with `yarn typecheck && yarn lint`, and CI is final.
- **A comment that switches the meta rule off fails in the second pass, not the first.** `/* eslint-disable */`, a block or same-line disable naming `sds/require-disable-reason`, and `/* eslint sds/require-disable-reason: off */` all pass the main pass and fail the disable guard. `yarn lint`, and so CI's `workspace` job, runs it. The Stop gate's ESLint call on the edited files does not, so such a comment survives a turn and fails at the next `yarn lint` or CI run.
- **A rule that reached zero can be re-recorded as if new.** Once pruning removes a rule's last entry, the base no longer mentions it, so the guard treats a later record of it as a switch-on. The job summary lists it as a new rule ID.

## Related

- [Work under the lint ratchet](../how-to/work-under-the-lint-ratchet.md): the day-to-day loop
- `scripts/check-suppressions-ratchet.mjs`, `scripts/eslint/plugin-sds.cjs`, `scripts/eslint/sds-exceptions.cjs`, `scripts/sds-report.mjs`
- The root `eslint.config.js` and the `workspace` job in `.github/workflows/ci.yml`
- [ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions)
