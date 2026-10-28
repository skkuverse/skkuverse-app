---
title: Clean Up the SDS API Without Aliases
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0019. Clean up the SDS API in one pass, with types in place of the temporary lint rules and no deprecated aliases

> Why the older SDS components took ADR 0015's names in one atomic change rather than behind aliases, which bypasses the types now refuse, what left the public API, and which behaviors the product decided. Read this before you rename an SDS prop or add a color input.

## Status

Accepted on 2026-10-13, by the API cleanup. It replaces §5 of [ADR 0015](0015-name-component-apis-in-seed-vocabulary.md), which planned deprecated aliases. The rest of ADR 0015 stands.

Narrowing `Txt` `color` to role names and removing `SdsColors` from `@skkuverse/shared`'s exports landed last, once the home screen, the last reader, moved onto roles.

## Context

- **ADR 0015 §5 planned a release of aliases.** Each old name would stay as `@deprecated` while the app moved call by call.
- **SDS has no consumer outside this repository.** It is React Native only, and skkuverse-web keeps its own UI package, so every caller of a renamed prop is in this tree.
- **Lint stood in for types during the migration.** `sds/no-free-color-prop` and `sds/no-txt-style-override` caught a free color prop and a font override, because the props still took any string or style while the migration ([ADR 0016](0016-ratchet-lint-debt-with-bulk-suppressions.md)) worked through the backlog.
- **The product decided several behaviors on 2026-10-11**, listed in §4.

## Decision

### 1. Renames are atomic, by codemod, with no aliases

An alias doubles the surface and needs a second sweep, and here it serves no outside consumer. `scripts/codemods/sds/prop-vocabulary.mjs` moved every caller in the same commit as each type change, and the type tests refuse every old name.

| Component | Before | After |
| --- | --- | --- |
| Button | `type`, `style`, sizes `tiny` … `big` | `tone` (`brand`, `critical`, `neutral`), `variant` (`solid`, `weak`), sizes `xsmall` … `large`, mapped by height |
| Button on a dark ground | `type="light"` | The `neutral` tone under `ColorSchemeProvider colorMode="dark-only"` |
| Loader | `type` | `tone` (`neutral`, `brand`, `staticWhite`) |
| IconButton | `variant` `fill` / `clear` / `border` | `weak` / `ghost` / `outline`, the Button's words |
| Border, `ListRow.Texts` | `type` | `variant`, `layout` |
| Badge, ListRow | `tiny`, `extraSmall` | `xsmall` |
| ListRow | `disabledStyle` `type1` / `type2` | A disabled row always fades: an on/off mode is a boolean |
| Toast | `duration` | None: the time is decided (§4) |

### 2. The types refuse what lint guarded, and the temporary rules are deleted

- **An SDS color prop takes a role name** (`FgColorName`, `BgColorName`). `Badge` and `Gradient`, which also draw colors no role names, take an `SdsColor` the caller vouches for with `asSdsColor()`. `sds/no-free-color-prop` is deleted.
- **`Txt` `style` refuses the type keys** (size, line height, spacing, family, weight). A recipe's text slot reaches `Txt` through the internal `txtSlot()`, and a display figure larger than the type scale's top step is React Native's `Text` behind a reasoned disable until the umbrella's scale adds a display step. `sds/no-txt-style-override` is deleted.
- **`Txt` `color` takes a foreground role name,** and a data color reaches text through `style.color` instead of an escape prop. Lint still rejects a literal there.

### 3. Dead weight leaves the public API

- The TDS theme layer (`useAdaptive`, `AdaptiveColorProvider`, `colorSeeds`, `getAdaptiveColors`, the Button's `token` override).
- The TDS color names, `SdsColors` and `resolveSdsColors`, from `@skkuverse/shared`'s exports. `colors.ts` keeps them for the bundled game pages and the codemods, which import the file itself.
- Every component with no importer outside the catalog, by that criterion rather than by a list, and the dependencies only they used.
- `sds-preview.tsx`. The state catalog (`apps/mobile/src/dev/sds-states/`) renders every exported component and every recipe's variant map, which `componentContract.test.mts` checks.

### 4. The decided behaviors

| Behavior | Where it is held |
| --- | --- |
| A confirm dialog closes only by its buttons; an alert keeps closing on a dimmer tap | `components/dialog/dimmer.ts` (DIALOG-03) |
| An item divider is `stroke.neutralSubtle`; a section band keeps its role | `components/border/borderRecipe.ts` (DIV-01) |
| A disabled Button or Chip is `bg.disabled` under `fg.disabled` | `BUTTON_DISABLED_ROLES`, `CHIP_DISABLED`, and the press hook's `disabledBg` |
| A text field keeps its label visible by default | `textFieldLabelFloats()` (FIELD-02) |
| A skeleton takes a `shape` that sets its radius | `components/skeleton/skeletonShape.ts` (LOAD-01) |
| A toast shows for `SdsDuration.toast`, `toastWithAction` with an action, paused while touched | `components/toast/toastTimer.ts` (TOAST-05) |
| A shadow is a level for a floating element | `SdsShadows` `level1` to `level3` (ELEV-05, [ADR 0018](0018-separate-cards-by-surface-not-shadow.md)) |

Moving hand-built parts onto SDS added the Callout's `ai` tone, SEED's `magic` drawn flat in `fg.ai` on `bg.aiWeak`; a `brand` tone for `ResultSection`'s primary action, for a sign-in gate; and the filter chip pattern, a `Chip.Toggle` with a caret in `Chip.SuffixIcon` that opens its sheet.

## Consequences

- **An old prop name is a type error.** There is no alias to find and no removal window to track.
- **A bypass the types refuse needs no lint rule.** The remaining `sds/*` rules cover what a type cannot see: literals, raw primitives, placement.
- **Some screens changed on screen** where a decided behavior or an SDS part replaced a hand-built one. The commit that made each change lists it, with the screens to check.
- **The catalog is the place to look.** A new component, variant or tone fails the contract test until the catalog renders it.

## Related

- [ADR 0015](0015-name-component-apis-in-seed-vocabulary.md): the vocabulary itself
- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): the decided behaviors and the lint rules table
- [design-usage.md](../reference/design-usage.md): when to use each component, with the rules above under their IDs
- `packages/sds/src/components/seedComponents.typetest.tsx`: every refusal in §1 and §2
