---
title: Name Component APIs in SEED's Vocabulary
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0015. Name component APIs in SEED's vocabulary, with one part per behaviour and role names for color

> Why SDS components name their axes `tone`, `variant` and `size`, split a component into parts when the parts behave differently, take a color only as a role name, and how the older components move to the same names. Read this before you add a prop to an SDS component or write a new one.

## Status

Accepted on 2026-10-10. `Chip`, `Callout` (with `ActionableCallout` and `DismissibleCallout`) and `ResultSection` are the first components written to it. §5, which planned deprecated aliases for the older components, is replaced by [ADR 0019](0019-clean-up-the-sds-api-without-aliases.md): they took these names in one atomic change, without aliases.

## Context

[ADR 0011](0011-adopt-seed-color-token-structure.md) to [ADR 0014](0014-give-press-feedback-by-surface-color-and-distance.md) moved SDS's tokens and press feedback onto SEED Design (daangn/seed-design). The component APIs were still TDS's, and inconsistent with each other.

- **One axis, several names.** The Button's meaning is `type` and its fill `style`, a name React Native reserves for `StyleProp`. The Loader calls its meaning `type` with other values, IconButton calls its fill `variant` with other values, Border uses `type` for a visual kind, and Rating uses `variant` for a layout.
- **Sizes have no shared scale.** The Button's sizes are `tiny`, `medium`, `large` and `big`; the Badge's `tiny` to `large`; ProgressBar's `size` is a weight.
- **Colors are free strings.** Badge, ListHeader, ProgressBar and IconButton take `color?: string`, so any hex reaches them.
- **The app builds the same things by hand.** The SEED migration inventory finds chips, banners and error or empty states drawn by hand many times over, each its own way. SDS had no chip and no callout, and its `Result` and `ErrorPage` were unused.
- **SEED has a written convention for all of this.** Across its component specs, `size` is the most common axis, then `tone`, then `variant`; `type` names a kind of content only. Its API guide splits a component into parts when they behave differently, rather than adding a mode prop, and its style props take a token name per property.

## Decision

### 1. One vocabulary for every axis

| Axis | Meaning | Values |
| --- | --- | --- |
| `tone` | What the color means | Role names: `neutral`, `brand`, `informative`, `positive`, `warning`, `critical` |
| `variant` | How the surface is drawn | A treatment: `solid`, `weak`, `outlineWeak`, … |
| `size` | A relative step | `small`, `medium`, `large` (and `xsmall`). A number only where the physical size is the contract |
| `weight` | Emphasis of a line or a mark | `regular` / `bold`, `thin` / `thick` |
| `layout` | How the content is arranged | `withText`, `iconOnly`, … |
| `type` | A kind of content | Never a visual role |

- **States are booleans, as SEED's Lynx preset has them** (`selected`, `disabled`), and a state the press animates is not a variant at all ([ADR 0014](0014-give-press-feedback-by-surface-color-and-distance.md)).
- **An on/off mode is a boolean**, not an enum that renames the default.
- **A prop that only makes sense in one mode is ruled out by the type**, not ignored at runtime.

### 2. A part per behaviour

When the parts of a component behave differently, they are separate parts over one look, not one component with a mode prop.

| Component | Parts | Shared |
| --- | --- | --- |
| Chip | `Chip.Button` (an action), `Chip.Toggle` (on and off), `Chip.RadioRoot` with `Chip.RadioItem` (one of several), plus `Chip.Label`, `Chip.PrefixIcon`, `Chip.SuffixIcon` | `chipRecipe` |
| Callout | `Callout` (static, may carry a link), `ActionableCallout` (one touch target, with a chevron), `DismissibleCallout` (a close button) | `calloutRecipe` |
| ResultSection | One component; its two actions are fixed in look | `resultSectionRecipe` |

- **A compound component is a namespace** (`Chip.*`). A component whose parts the caller never rearranges takes flat props instead (`title`, `description`, `primaryActionProps`), as SEED's snippets do.
- **State names are SEED's**: `value` / `defaultValue` / `onValueChange`, `checked` / `defaultChecked` / `onCheckedChange`, `open` / `defaultOpen` / `onDismiss`. A change is reported in both the controlled and the uncontrolled mode (`useControllableState`).
- **Each part announces its behaviour.** A button is `button`; a toggle is `togglebutton` and a radio item `radio`, both reporting `checked`, the state React Native pairs with those roles (on Android they are checkable, and a `selected` state would be read as not checked); the group is `radiogroup`.
- **No `asChild`.** React Native has no DOM slot to hand the element to, and SEED's Lynx build leaves it out for the same reason.

### 3. A color is a role name, never a string

A new component has no free color prop. Its colors come from its `tone` and `variant`, and where a color must be named it is a role: `PressableBgToken` for a surface, `FgColorName` for text, `StrokeColorName` for a line. SEED's escape hatch, `(string & {})`, is not adopted: a component that needs a color the roles lack is a missing role, not a missing string.

### 4. What the three components take from SEED

| Component | Kept | Left out or added, and why |
| --- | --- | --- |
| Chip | `variant` `solid` and `outlineWeak`, the three sizes with SEED's heights and insets, t4 medium labels | `outlineStrong`, `layout="iconOnly"` and the prefix avatar: nothing in the app draws them. `tone` (`neutral`, `brand`) is added for the selected state, the way SEED's checkmark, radiomark and switchmark use it: the app's selected chips are brand-colored. A disabled chip reads `bg.disabled` and `fg.disabled` rather than SEED's opacity, as SEED's buttons do |
| Callout | The shape (padding, gap, radius, minimum height), one paragraph of t4 with the title bold, the five shared tones on their weak surfaces | `magic` is Daangn's AI tone, drawn with a gradient SDS has no token for, so SDS's `ai` tone takes its place flat (`fg.ai` on `bg.aiWeak`). `brand` is added on `bg.brandWeak` |
| ResultSection | `size` `large` and `medium`, `asset`, `title`, `description`, `primaryActionProps`, `secondaryActionProps`, the neutral weak primary and the ghost secondary | SEED names its text styles by its own scale, so each is carried over by pixel size (ADR 0012). The asset gets SEED's example spacing below it. The primary may take `tone: 'brand'` for a sign-in gate, whose only way on is the core action |

The values are in each component's `*Recipe.ts`, and its `*Recipe.test.mts` pins them against SEED's spec. A selected chip only shrinks under the finger, because its fill already shows the state (ADR 0014). Every label and accessibility label is the caller's.

### 5. The older components take the same names

This section first planned a release of `@deprecated` aliases. [ADR 0019](0019-clean-up-the-sds-api-without-aliases.md) replaced that plan. SDS has no consumer outside this repository, so every caller moved in the same change as the type, which also refuses the old name. ADR 0019 lists what each component took.

## Consequences

- **The app's hand-built chips, banners and result states have a target.** Each moved one place as proof (a link pill, the notification settings hint, the leaderboard's empty and error states); the rest move in the bulk migration.
- **Some places will change on screen when they move.** A callout is larger and darker than most hand-built banners, and SEED's selected chip is a solid fill where the app often used a weak tint (`outlineWeak` with `tone="brand"` is the nearest).
- **One vocabulary across SDS.** Since the cleanup (ADR 0019), no component selects a look by `type`, and `ResultSection` exposes only a `tone` for its primary action, never the Button's own props.
- **A part that is never selected cannot take a selection color.** `Chip.Button` has no `tone`. A removable chip that shows a selected fill is a `Chip.Toggle`, or a new part, not a Button with a color.

## Related

- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): the Component API vocabulary section
- `packages/sds/src/components/{chip,callout,result-section}/`, and `seedComponents.typetest.tsx`, which pins the rules above
- [ADR 0012](0012-name-type-scale-in-seed-direction.md): carrying a SEED text style over by size, [ADR 0014](0014-give-press-feedback-by-surface-color-and-distance.md): the press and the recipe convention
