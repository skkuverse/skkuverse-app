---
title: Name Spacing and Radius After SEED's Scales
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0013. Name spacing and radius after SEED's dimension and radius scales

> Why `SdsSpacing` and `SdsRadius` use SEED's step names, why `SdsRadius.full` is a pill now, and why the TDS names are still in the files. Read this before you add a step or reach for a spacing or radius literal.

## Status

Accepted on 2026-10-10. Every call site moved in one change, and nothing on screen moved. The TDS names are still there as deprecated aliases, because the web repos vendor the two files.

## Context

The spacing and radius tokens came from TDS, with the color and type tokens that [ADR 0011](0011-adopt-seed-color-token-structure.md) and [ADR 0012](0012-name-type-scale-in-seed-direction.md) moved toward SEED Design (daangn/seed-design).

- **The names had no room between steps.** `SdsSpacing` ran `xxs`, `xs`, `sm`, `md`, `base`, `lg`, `xl`, `xxl`. Nothing fits between `xs` and `sm`, so the half steps the app draws (6, 10 and 14) stayed literals.
- **`SdsRadius.full` was 20, not a pill.** A shape that was meant to be a pill wrote `borderRadius: 999` instead.
- **SEED puts the value in the name.** `$dimension.x{n}` is n × 4px and `x{n}_5` is the half step above it. `$radius.r{n}` follows the same rule, and `$radius.full` is 9999.

The components that come next (Chip, Callout, a result section) need padding and radius tokens. A name with no room for a step pushes those values back into literals.

## Decision

### 1. The scales are SEED's, names and values

`SdsSpacing` holds every step of SEED's `dimension.yaml`, and `SdsRadius` every step of its `radius.yaml`. Each old value was already on SEED's scale, so the old names mapped without moving a pixel.

The table holds the values at the time of this decision. `packages/shared/src/tokens/__tests__/spacing.test.ts` and `radius.test.ts` pin the live ones.

| Spacing | Value | Old TDS name |
| --- | --- | --- |
| `x0_5` | 2 | `xxs` |
| `x1` | 4 | `xs` |
| `x1_5` | 6 | — |
| `x2` | 8 | `sm` |
| `x2_5` | 10 | — |
| `x3` | 12 | `md` |
| `x3_5` | 14 | — |
| `x4` | 16 | `base` |
| `x4_5` | 18 | — |
| `x5` | 20 | `lg` |
| `x6` | 24 | `xl` |
| `x7` | 28 | — |
| `x8` | 32 | `xxl` |
| `x9` | 36 | — |
| `x10` | 40 | — |
| `x12` | 48 | — |
| `x13` | 52 | — |
| `x14` | 56 | — |
| `x16` | 64 | — |

| Radius | Value | Old TDS name |
| --- | --- | --- |
| `r0_5` | 2 | — |
| `r1` | 4 | `xs` |
| `r1_5` | 6 | — |
| `r2` | 8 | `sm` |
| `r2_5` | 10 | — |
| `r3` | 12 | `md` |
| `r3_5` | 14 | `lg` |
| `r4` | 16 | `xl` |
| `r5` | 20 | `full` |
| `r6` | 24 | — |
| `full` | 9999 | — |

### 2. `full` is a pill

React Native scales a corner radius larger than the box down to half its shorter side, so 9999 rounds any box fully. The app already relied on that with `999`.

The rename ran in this order, so that no shape changed:

1. Every read of the old `full` (20) moved to `r5`.
2. `full` became 9999.
3. A `borderRadius: 999` that drew a pill became `SdsRadius.full`, and so did the `99` on the Button's loading dots. Pills in the bundled typing game's page also became `full`. `full` in CSS clamps the same way, so the page draws the same badge.
4. The place sheet's link pills read the old `full` and moved on to `full`. At 36 and 28 tall, their 20 radius was already clamped to half their height.

### 3. The TDS names stay, as aliases the app may not read

The umbrella's `design.spacing` and `design.radius` contracts copy both files byte for byte into skkuverse-web and the mini-app repository. Their `CssSpacing` and `CssRadius` adapters map every key, and the mini-app repository publishes them in `@skkuverse/tokens`. A name removed here disappears there at the next freshness PR, and this repo cannot see who reads it.

- **Each TDS name is a `@deprecated` alias** that points at its step. The files still import nothing.
- **The app may not read an alias.** `eslint.config.js` rejects `SdsSpacing.sm` and its kind through `no-restricted-syntax`, and the message names the step to use.
- **The old `full` is gone.** SEED's pill took the name, so no alias could keep 20.

### 4. No semantic spacing yet

SEED adds six semantic spacings over the scale, `global-gutter` among them. This change adds none.

- **The gutter is not one value.** At the time of writing, 20 is the most common full-width horizontal padding. It is used on the tab lists, notice detail, settings and the bottom CTA. But 16 holds the search field, the building sheet and the campus sheet column, and 24 holds the prompt sheets and dialogs.
- **Nothing would read it.** The literals stay put in this change, so a `globalGutter` would have no reader.
- **The name would mislead.** SEED's `global-gutter` is 16 and the app's would be 20, the same trap ADR 0012 avoided for sizes.

A semantic spacing should arrive with the migration that gives it its readers.

### 5. The literals move later

Spacing and radius literals stay in this change. Moving them belongs with a lint ratchet that stops new ones. At the time of writing, 93% of nonzero padding, margin and gap literals already sit on the scale. For radius literals, the share is 77%. Off the scale, spacing is mostly odd small values (1, 3, 5 and 7). Radius is mostly half of a fixed height, such as 22 on a 44 button or 26 on a 52 one: a circle or a pill that `full` can name.

## Consequences

- **Nothing on screen changes.** Every renamed step keeps its value, and each pill that became `full` was clamped to the same shape before.
- **A new step takes SEED's name.** The value is in the name, so a missing step never means a new word. A value off SEED's scale calls for a design decision before any token.
- **The web copies change shape when they pull.** `CssSpacing` and `CssRadius` gain the SEED keys and keep the old ones, except `CssRadius.full`, which goes from 20px to 9999px. At the time of writing nothing in either repo reads it.
- **Removing the aliases is a cross-repo change.** The web repos have to stop reading the TDS names first, and the change belongs in the umbrella.

## Related

- `packages/shared/src/tokens/spacing.ts`, `radius.ts`: the scales and their aliases
- [ADR 0011](0011-adopt-seed-color-token-structure.md), [ADR 0012](0012-name-type-scale-in-seed-direction.md): the color and type halves of the move to SEED
