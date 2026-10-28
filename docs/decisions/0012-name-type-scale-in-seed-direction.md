---
title: Name the Type Scale in SEED's Direction
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-10
audience: internal
---

# 0012. Name the type scale in SEED's direction and keep SDS's sizes

> Why SDS type sizes are one scale numbered from the smallest up, why the sizes are still SDS's own, and what each old TDS name became. Read this before you add a size or copy one from SEED.

## Status

Accepted on 2026-10-10. The rename landed in one change with no aliases, and nothing on screen moved.

## Context

SDS inherited two typography vocabularies from TDS, and they ran in the opposite direction from SEED Design (daangn/seed-design), whose color structure [ADR 0011](0011-adopt-seed-color-token-structure.md) adopted.

- **`Txt`'s `typography` prop** took `t1`–`t7`, where `t1` was the largest (30px), plus TDS's sub-steps `st1`–`st13` between them. A size could have two names (`t3` and `st6` were both 22px), and five sub-steps had no caller at all.
- **`SdsTypo`**, the style objects a StyleSheet spreads, had `t1`–`t7` with a weight baked in, plus `sub5`–`sub13`. Nothing in its names said which weight a style carried.
- **SEED numbers the other way.** Its `t1` is the smallest (11px) and the number rises with the size, and a text style is named `t{n}{Regular|Medium|Bold}`.

A name that means a different size in each system compiles everywhere. Moving toward SEED one call site at a time would have mixed the two directions in one file with no error to show it.

## Decision

### 1. One scale, numbered from the smallest

`SdsTypeScale` in `packages/shared/src/tokens/typography.ts` holds every size with its absolute line height. `t1` is the smallest, and each step is larger in both size and line height than the one below it. `Txt`'s `typography` prop takes a step and nothing else. Its type is the scale's key union, so an old sub-step name fails typecheck.

### 2. The sizes stay SDS's own

Only the direction and the grammar are SEED's. The scale holds the sizes the app already drew, so from `t5` up a step shares SEED's number but not its size. SEED has no 15px or 17px, and moving the body text to SEED's 16px would change every screen. A size is read from `SdsTypeScale`, never copied from SEED by its step name.

Building the scale took four rules:

1. **Measure every consumer.** The census covered `typography="…"` in JSX, a name inside a `typography={…}` expression, the component maps that pick a name (`Button`'s `sizeToTypography`, `Badge`'s `sizeVariant`, `ListRow`, `StepperRow`, `NumericSpinner`, `Tab`), every `SdsTypo` member read, and a style map keyed by name (`HallOfFameTitle`).
2. **Drop a size with no consumer.** That removed 19, 21, 23, 24 and 27px.
3. **Fold a stray size into its neighbor**, meaning one with one or two callers that sits 1px from another step. None qualified. The rarest sizes were kept on a stated ground:
   - **28px** has one caller, but it sits 2px from either neighbor and is on SEED's scale.
   - **18px** has one map, but that map labels every large and big `Button`, it is on SEED's scale, and folding it into 17px would move every bottom CTA.
   - **14px** has several callers and is on SEED's scale.
4. **One line height per size.** Where a TDS main step and a sub-step shared a size (22px, 26px) they also shared a line height, so no line height changed.

What remained was numbered from the smallest up. The table holds the values at the time of this decision. `packages/shared/src/tokens/__tests__/typography.test.ts` pins the live ones.

| Step | Size / line height | Old `Txt` name | Old `SdsTypo` name | SEED at the same number |
| --- | --- | --- | --- | --- |
| `t1` | 11 / 16.5 | `st13` | `sub13` | 11 / 15 |
| `t2` | 12 / 18 | `st12` | `sub12` | 12 / 16 |
| `t3` | 13 / 19.5 | `t7` | `t7` | 13 / 18 |
| `t4` | 14 / 21 | `st11` | — | 14 / 19 |
| `t5` | 15 / 22.5 | `t6` | `t6` | 16 / 22 |
| `t6` | 16 / 24 | `st10` | `sub10` | 18 / 24 |
| `t7` | 17 / 25.5 | `t5` | `t5` | 20 / 27 |
| `t8` | 18 / 27 | `st9` | — | 22 / 30 |
| `t9` | 20 / 29 | `t4` | `t4` | 24 / 32 |
| `t10` | 22 / 31 | `t3`, `st6` | `t3` | 26 / 35 |
| `t11` | 26 / 35 | `t2`, `st3` | `t2` | 28 / 38 |
| `t12` | 28 / 38 | `st1` | — | 32 / 42 |
| `t13` | 30 / 40 | `t1` | `t1` | 40 / 52 |

`t1` through `t4` match SEED's sizes. SDS's small steps keep their taller line height (1.5×), where SEED's sit near 1.35×.

### 3. Size and weight are separate, as in SEED's `Text`

- **`Txt` takes the step and a weight on its own.** `<Txt typography="t7" fontWeight="bold">` keeps the `fontWeight` prop it always had, the split SEED's React `Text` makes between `fontSize` and `fontWeight`.
- **`SdsTypo` names carry the weight.** A style is `t{n}{Regular|Medium|SemiBold|Bold}`. SEED has no 600, but SDS's smallest style uses it, so that one style is `t1SemiBold`.
- **`SdsTypo` holds only the pairs the app reads**, each built from the scale (`t1SemiBold`, `t2Regular`, `t3Regular`, `t5Regular`, `t6Regular`, `t7Regular`, `t9Bold`, `t10Bold`, `t11Bold`, `t13Bold`). The two old styles whose sizes left the scale (`sub5`, `sub8`) had no reader and were removed. A weight it lacks is spread as `...wantedSans('<weight>')` after the step's style, the rule `eslint.config.js` already enforces.

### 4. One change, no aliases

The old `t1` (largest) and the new `t1` (smallest) cannot coexist under one name, so every call site moved in the same change and the old names were deleted. The rewrite ran from one explicit old-to-new table in a single substitution pass per file, so no name was rewritten twice. Each file's previous content, mapped by the same table, was diffed against the result, and the only typography differences left were hand-edited comments and labels.

No name crosses a process boundary. The server and the SDUI payloads send no typography name, since the SDUI widgets read `SdsTypo` themselves, and the bundled games draw no SDS text.

## Consequences

- **Nothing on screen changes.** No size was folded and no line height moved.
- **A new size renumbers.** The steps run without a gap, so a size inserted between two steps shifts every name above it, and that shift has to land as one change like this one. Prefer an existing step.
- **Text still ignores the OS font size.** `Txt` passes `allowFontScaling={false}` as before. Following the setting with a cap per style, as SEED does, is a separate decision.
- **The web copies are behind.** `typography.ts` is the producer of the umbrella's `design.typography` contract, vendored into skkuverse-web and the mini-app repository as `packages/tokens/src/typography.ts`.
  - The vendored copy already predates the file's runtime `react-native` import, so a freshness pull cannot take it byte for byte.
  - This change renames the `SdsTypo` keys on top of that. The mini-app repository reads `CssTypo.t3`, `t5` and `t6` by the old names.
  - Both repos also keep an ungated hand copy of the old `packages/sds/src/foundation/typography.ts` in `packages/ui`.
  - Bringing them across is a contract change in the umbrella, not an edit here.

## Related

- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): the typography API
- `packages/shared/src/tokens/typography.ts`: the scale and the text styles
- `packages/shared/src/tokens/__tests__/typography.test.ts`: the pinned scale, its direction and the style names
- [ADR 0011](0011-adopt-seed-color-token-structure.md): the color half of the move to SEED's structure
