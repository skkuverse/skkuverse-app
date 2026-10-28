---
title: Separate Cards by Surface, Not Shadow
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-13
audience: internal
---

# 0018. Separate cards by surface or stroke, and keep shadows for floating elements

> Why a card in the app casts no shadow, what sets it apart from its ground instead, and which elements still cast one. Read this before you add a shadow token or give a shadow to a card, a tile or a panel.

## Status

Accepted on 2026-10-11. The cards that cast `SdsShadows.card` moved off it, and the token is gone. The floating elements took shadow levels in the API cleanup (sds-7), below.

## Context

ELEV-04 in [design-usage.md](../reference/design-usage.md#elev-04) already said that a card separates by surface or stroke. These kinds of card still cast the `card` shadow, which was too faint to separate anything:

- **The news cards on home** (`ExternalActivitiesSection`), white tiles on the home ground.
- **The onboarding gate card on home** (`HomeOnboardingGateCard`), also white on the home ground.
- **The mock notice card** on the pre-sign-in screens (`components/previews`), which already had a hairline border, plus a soft lift of its own.

The shadow did no work on any of them:

- **It was nearly invisible in light mode.** A 4% black blur three points wide reads as a smudge at best. What told each card apart was the white surface on the grey ground, or the border.
- **It disappears in dark mode.** A black shadow on a near-black ground draws nothing. A card that relies on one has no edge once the app offers dark mode.
- **SEED uses elevation for things that float.** In SEED, a shadow says "this sits above the page". That holds for a floating button, a popover or a sheet, and it never holds for a card in the flow of a list.

The user decided the rule on 2026-10-11, together with subtle item dividers (DIV-01): card shadows go, and shadows stay only on floating elements.

## Decision

### 1. A card separates from its ground by surface or by stroke

Pick one, per screen:

- **Surface.** A `bg.layerDefault` card on a `bg.layerBasement` ground, or any card whose fill differs from the ground it sits on.
- **Stroke.** A `stroke.neutralWeak` border, for a card whose fill matches its ground.

A card never uses a shadow to stand out, in either scheme.

### 2. Shadows are for floating elements only

A shadow marks an element that floats above the screen and keeps its place as the content moves:

- floating buttons, such as the realtime refresh button
- popovers and floating panels over a map
- the sheet and the bottom CTA
- the floating search capsule

These take their shadow from an `SdsShadows` level, never spelled out (`sds/no-raw-shadow`):

| Level | For |
| --- | --- |
| `level1` | A small mark lifted off busy content, such as a badge on a thumbnail |
| `level2` | A floating control, such as a floating action button or a map control |
| `level3` | A floating panel or capsule over the content: a card over the map, the floating search capsule |

`glassFloat` is `level2` softened beside a real Liquid Glass surface, and the segmented control's indicator keeps a lift of its own inside the control.

### 3. The cards that moved

| Card | Before | After |
| --- | --- | --- |
| Home news cards | Surface and the `card` shadow | Surface alone |
| Home onboarding gate card | Surface and the `card` shadow | Surface alone |
| Mock notice card | Hairline border and a soft lift | Hairline border alone |

### 4. `SdsShadows.card` is removed

With no card left to cast it, the token is deleted rather than left for the next card to reach for. `shadows.ts` is not vendored to the web repos, so nothing outside this repo reads it.

## Consequences

- **A card's edge survives dark mode.** Surface and stroke are roles with dark values. A shadow had none to give.
- **Reviews have one question.** A shadow on something that does not float is a finding, under ELEV-04.
- **Floating elements take a level, never a value.** The floating shadows that were spelled out because no token had their depth (the map tile badge, the HSSC place card, the notices search capsule and the glass fallback) moved onto the levels, and the ad hoc `elevated` and unused `bottomSheet` tokens went (ELEV-05).
- **A glow is not a shadow.** `GlowBackdrop` draws a colored glow that marks fresh AI content. It is emphasis, not elevation, and this decision does not cover it.

## Related

- [design-usage.md](../reference/design-usage.md#elev-04): ELEV-04 and ELEV-05
- [ADR 0011](0011-adopt-seed-color-token-structure.md): the layer and stroke roles a card uses
- `packages/shared/src/tokens/shadows.ts`: the shadow tokens that remain
