---
title: Add a Screen Gutter Token
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-11
audience: internal
---

# 0017. Add `SdsSpacing.gutter` for the inset between the screen edge and content

> Why the app has one semantic spacing, `SdsSpacing.gutter`, why it is `x5` and not SEED's 16, and which literals moved onto it. Read this before you pad full-width content from the screen edge, or add another semantic spacing.

## Status

Accepted on 2026-10-11. The token exists, and the screen-edge 20s moved onto it with no change on screen. Full-width screens inset by another value have not moved yet.

## Context

[ADR 0013](0013-name-spacing-and-radius-after-seed.md) §4 left semantic spacing out, for three reasons: the gutter was not one value, nothing would read a token, and SEED's name would mislead.

- **The migration gives it readers.** The K2 batch of the SDS migration moves every spacing literal onto a token. A screen-edge inset written as `SdsSpacing.x5` says how far, and nothing says it is the gutter. SPACE-02 in [design-usage.md](../reference/design-usage.md#space-02) asks for one gutter on every screen, and only a name makes that checkable in review.
- **20 is the gutter the app draws most.** The tab lists, notice detail, settings, the bus screens and the bottom CTA inset by 20. Some full-width screens use 16, such as the search field, the building sheet and the campus sheet column. Prompt sheets and dialogs use 24.
- **SEED's `global-gutter` is 16.** Under that name, a reader would expect 16.

## Decision

### 1. One token, `SdsSpacing.gutter`, equal to `x5`

`spacing.ts` gains `gutter: scale.x5`. It names the horizontal inset between the safe-area edge and full-width content (SPACE-02, SPACE-03), and a row that aligns with that content (LIST-03).

- **The name is SDS's own.** It is not `globalGutter`, so it does not borrow SEED's meaning along with its name, the same choice [ADR 0012](0012-name-type-scale-in-seed-direction.md) made for sizes.
- **It points at a step.** It is not a new value, and the scale test pins it to `x5`. Moving the gutter means pointing it at another step, never changing a step's value.
- **It is the only semantic spacing.** The other spacings SEED names stay open items, each waiting for a reader.

### 2. K2 moved the screen-edge 20s, and nothing else

The spacing codemod (`scripts/codemods/sds/spacing-radius.mjs`) writes `SdsSpacing.gutter` for a horizontal padding or margin of 20, such as `paddingHorizontal` or `marginLeft`. It writes `x5` for every other 20.

- **A horizontal 20 is the screen edge in all but two places.** A button's own padding and the padding inside a card with its own margin draw 20 too. The codemod lists both by file and style key, and gives them `x5`.
- **A vertical 20 is never the gutter.** It is spacing between blocks.
- **Nothing moved on screen.** The gutter is 20, the value each literal had.

### 3. The other insets move with screenshots

A full-width screen inset by 16 or 24 moves onto the gutter in a later batch, since that changes the screen. Each move needs before and after screenshots. A sheet or dialog that keeps a different inset on purpose keeps its step.

## Consequences

- **A full-width screen writes `SdsSpacing.gutter`.** A screen-edge `x5` is a review finding. The lint rule cannot tell an edge inset from other spacing, so it does not flag one.
- **The vendored copies gain a key.** The umbrella's `design.spacing` contract copies `spacing.ts` byte for byte into skkuverse-web and the mini-app repository. Their next sync changes the contract hash, and their `CssSpacing` adapters gain a `gutter` key.
- **Moving the gutter is one edit.** If the gutter changes, every screen that reads it moves together, and that change needs screenshots of each one.

## Related

- [ADR 0013](0013-name-spacing-and-radius-after-seed.md): the spacing scale, and why semantic spacing waited
- [design-usage.md](../reference/design-usage.md#screen-gutter): SPACE-02, and the screen insets not yet moved
- `packages/shared/src/tokens/spacing.ts`: the token
