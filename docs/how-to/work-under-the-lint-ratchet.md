---
title: Work Under the Lint Ratchet
type: how-to
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-25
audience: internal
---

# Work Under the Lint Ratchet

> The day-to-day loop under the lint ratchet, from a lint failure on a recorded rule to renaming a file or adding an exception. Read this when `yarn lint` mentions suppressions, or before you touch `eslint-suppressions.json`.

## Overview

A rule can run at `error` over violations that already exist because `eslint-suppressions.json` records them per file and rule. Lint fails on anything beyond the record, and the record may only shrink. [ADR 0016](../decisions/0016-ratchet-lint-debt-with-bulk-suppressions.md) explains the mechanism.

The daily loop has three steps:

1. Fix the code.
2. Run `yarn lint:prune` if you fixed recorded violations.
3. Commit the code and the smaller record together.

> [!WARNING]
> Never run `eslint --suppress-all` or `--suppress-rule` to make lint pass. ESLint accepts the
> larger record, but `scripts/check-suppressions-ratchet.mjs` fails it in `yarn lint`, in the
> Stop gate and in CI. The only way back is to fix the code.

## Prerequisites

- Run every command from the repository root. ESLint reads the record from the working directory, so from anywhere else the record does not apply.
- Your editor shows recorded violations as errors, because ESLint 9's editor integration does not apply the record. Trust `yarn lint` instead.

## Steps

### Lint lists many violations in a file you edited

ESLint lists every violation of a rule in a file once the file goes over its recorded count, and it cannot tell which one is new. When a legacy file shows a whole list, your change added one.

1. Find the violation your diff introduced and fix it. Leave the others for their migration batch.
2. Run `yarn lint` again.

A file the record does not list starts at zero, so a new file must be clean from its first commit.

### You fixed recorded violations

Lint now fails with exit 2 and `There are suppressions left that do not occur anymore`, and `yarn lint` adds a line telling you to run `yarn lint:prune`. That is the record asking to shrink.

1. Run `yarn lint:prune` to lower the counts. With paths, it prunes only those files and runs faster:

   ```bash
   yarn lint:prune <path>...
   ```

2. Run `yarn lint` to confirm it passes.
3. Commit the record with the fix. `yarn sds:report` prints the new totals for the commit message.

### You rename or move a file

The record is keyed by path, so the new path starts at zero and every recorded violation in the file fails.

1. Move the file with `git mv`, so git records the rename.
2. In `eslint-suppressions.json`, change the old path key to the new one and keep its counts.
3. Run `yarn lint`. The guard allows the moved entry because git saw the rename.

### You delete a file

1. Run `yarn lint:prune`. It drops the entries of files that no longer exist, which the guard otherwise reports.

### A rule does not apply here

Use one of the three exception forms, and nothing else:

| Situation | Form |
| --- | --- |
| One line | `// eslint-disable-next-line <plugin>/<rule> -- <reason>`, where the reason says why the rule does not apply |
| A whole file outside an `sds/*` rule's purpose, such as a data table of route colors | An entry `{ files, rules, reason }` in `scripts/eslint/sds-exceptions.cjs`, with exact paths |
| A whole area the rule does not govern | The rule's `files` scope in `eslint.config.js` |

A block or file-wide `/* eslint-disable sds/<rule> */` or `arch/<rule>` fails lint even with a reason, and so does a disable that names no rule. A disable of any rule, `react-hooks/exhaustive-deps` included, fails without a reason. A comment that switches off `sds/require-disable-reason` itself fails too: `yarn lint` checks that rule a second time with inline config off (`scripts/eslint/disable-guard.mjs`). The Stop gate runs that second pass on the files it lints. Do not move or rename a file so that a rule stops matching it.

### You want to see the debt and the exceptions

| Command | Prints |
| --- | --- |
| `yarn sds:report` | The recorded total per rule, from the record alone |
| `yarn sds:exceptions [paths]` | Every `sds/*` disable comment with its reason, every registry entry, and the recorded debt per file and rule, each labelled as an exception or as debt. It lints without a cache, so the whole tree takes a while. `--all` includes every rule |

### You switch a rule on

This is not part of the daily loop. It happens once per rule, in the commit that adds the rule.

1. Add the rule to `eslint.config.js` at `error`, never `warn`.
2. Record that rule alone, without `--fix`:

   ```bash
   node_modules/.bin/eslint . --no-cache --suppress-rule sds/<rule>
   ```

3. Run `yarn lint` and commit the config and the record together. CI lists the new rule ID in the job summary.

## Troubleshooting

| Message | Meaning | Action |
| --- | --- | --- |
| `<file>: <rule> grew from N to M` | The record holds more for that file than the base did | Restore the entry's count and fix the violation |
| `<file>: <rule> has a new entry` | The record lists a file and rule the base did not | Fix the code. After a rename, check it went through `git mv` |
| `<file>: recorded, but the file does not exist` | The file was deleted or moved and its entry stayed | `yarn lint:prune`, or move the entry with the file |
| `There are suppressions left that do not occur anymore` | Recorded violations were fixed | `yarn lint:prune`, then commit the record |
| `Disabling <rule> needs a reason` | A disable has no reason, or a short one | Add `-- <reason>` |
| `A block or file-wide disable of <rule>` | A range disable reaches an `sds/*` or `arch/*` rule | Disable one line with a reason, or add a registry entry for an `sds/*` rule |
| `This use* hook passes N lines of code` (or `This file`), on line 1 | `arch/file-size`: the file started a step past its budget ([ADR 0025](../decisions/0025-ratchet-file-size.md)) | Move a concern into a private hook or component, or a decision into a `.rules` file. After a split, `yarn lint:prune` |
| `Unused eslint-disable directive` | The disable no longer suppresses anything | Delete it |
| `disable guard: these comments break sds/require-disable-reason` | A comment switches off the meta rule itself, so the main pass could not report it | Replace it with a line-level disable that names the rule and gives a reason |

## Related

- [ADR 0016](../decisions/0016-ratchet-lint-debt-with-bulk-suppressions.md): why the record, the guard and the three exception forms
- `scripts/check-suppressions-ratchet.mjs`: the guard and its rules
- `scripts/eslint/plugin-sds.cjs` and `scripts/eslint/sds-exceptions.cjs`: the rules and the file-level exceptions
