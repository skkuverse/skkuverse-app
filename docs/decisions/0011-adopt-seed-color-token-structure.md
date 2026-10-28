---
title: Adopt SEED's Color Token Structure
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-13
audience: internal
---

# 0011. Adopt SEED's color token structure: an adaptive palette under a semantic layer

> Why SDS colors are roles over an adaptive palette, where the brand and the CTA are on it, and why the app still renders light only. Read this before you add a color token or turn dark mode on.

## Status

Accepted on 2026-10-10. Dark mode stays off. With this decision in place, turning it on takes a switch and a migration of the remaining static reads.

## Context

SDS inherited its colors from TDS: a flat table of names (`SdsColors.grey700`, `SdsColors.brand`) read as static values. Most of the app reads that table, in several hundred call sites at the time of writing.

A name in it said which grey it was, and nothing about what it was for. So a role could not move without moving every place that happened to share its value.

The brand had three greens and no rule for them. The CTA's deep green lived as a hand-copied literal in about a dozen files. The `brand` name held a mid green just under 4.5:1 on white, and `brandDark` held a third. The Button derived its pressed state from the seed hex at an alpha, laid over that same hex, which drew no change at all.

`SDSProvider` took a light or dark preference, and `useShadow` asked the OS directly, so the scheme had two sources.

Some names did two jobs, and each would turn wrong in dark. `background` was a surface and also the label on the CTA, a label that has to stay white. `brandDark` was a text color and a candidate header surface, a surface that has to stay dark. The `greyOpacity*` values were black alphas, which vanish on a black ground.

The first stage of this work made the palette adaptive (`SdsPalette` in `packages/shared/src/tokens/colors.ts`, described in `packages/sds/SDS.md`). This decision adds the layer above it, after SEED Design (daangn/seed-design), whose color roles separate value from meaning the same way.

## Decision

### 1. Semantic roles name steps of the adaptive palette

- **The palette** (`colors.ts`) holds every hex value, one per mode per step. It stays a file with no imports, because the umbrella's `design.colors` contract vendors it byte for byte.
- **The roles** (`packages/shared/src/tokens/semanticColors.ts`) import it and name steps, never hexes. The grammar is SEED's. A name is a property (`fg`, `bg`, `stroke`), a role (`neutral`, `brand`, `critical`, `informative`, `positive`, `warning`, the layers, `overlay`, `disabled`, `placeholder`, `transparent`), a variant (`solid`, `weak`, `muted`, `subtle`, `contrast`, `on*Solid`) and a state (`Pressed`, `Selected`). TS names are camelCase paths such as `color.bg.brandSolid`.
- **Every token holds a light and a dark value.** Leaving a mode out is a compile error, and the test checks that every value comes from the palette.
- **SDS keeps the roles it uses.** SEED's product tokens (`magic`, `banner`, `manner-temp`), its deprecated tokens and `focus-ring` are left out.
- **A role names the step SEED's does** (`fg.{role}` at 700, `-contrast` at 900, `weak` at 100, `stroke.*Weak` at 300), since the palette's steps are SEED's. The brand (section 3) and `bg.neutralSolid` (section 4) are the exceptions.

### 2. Contrast is designed for both modes and measured with WCAG 2.x

The contrast standard is WCAG 2.x, chosen over APCA on 2026-10-11: the platforms' own checkers report it, and it is the stricter of the two on status colors at body size. The helper is one file (`packages/shared/src/tokens/__tests__/contrast.ts`), so a later switch would stay local. The usage rules that follow from it are A11Y-01 and COLOR-11 in [design-usage.md](../reference/design-usage.md#a11y-01).

`semanticColors.test.ts` holds, in both modes, the foreground and background pairs the roles exist for. Neutral text sits on the layers, and each `on*Solid` foreground sits on its fill. Each `-contrast` foreground sits on its weak fill. Body text must reach 4.5:1. Large or bold text, icons and other non-text marks must reach 3:1.

- **A status color at SEED's step is a 3:1 color.** At step 700, `fg.critical`, `fg.informative`, `fg.positive` and `fg.warning` measure under 4.5:1 on white under WCAG 2.x. SEED's own standard is APCA, which passes them. They are for icons and large or bold text, and body-size text in a status color takes `-contrast`. The white label on a status solid is held to the same 3:1.
- **Some roles stay out of the pairs.** WCAG sets no minimum for a disabled control (`fg.disabled`). `fg.placeholder` was left out while the standard was open, since WCAG 2.x and APCA disagree most on it. WCAG 2.x is now the standard and the role still sits below its body-text threshold, so holding it to a pair is an open follow-up. A placeholder never carries a field's meaning alone (FIELD-02 keeps a visible label). WCAG measures the resting state, so pressed fills are out too. The CTA's pressed fill is the exception, held to 3:1 because the label stays on it.

### 3. The brand is pine, and the CTA is `bg.brandSolid`

The brand's hue is `pine`, kept apart from `green` (positive) the way SEED keeps its brand palette apart. Its roles follow SEED's nine brand tokens. The values come from SDS and never from Daangn.

| Role | Light | Dark | Why |
| --- | --- | --- | --- |
| `bg.brandSolid` | pine 900 | pine 500 | The CTA keeps the deep green it has always filled with. In dark, 900 is a light mint that a white label cannot sit on. Pine 500 is the lightest dark step whose white label clears 4.5:1, and SEED's positive solid takes 500 in dark as well |
| `bg.brandSolidPressed` | pine 1000 | pine 600 | One step away from the background: darker in light, lighter in dark. The white label stays above 3:1 while pressed |
| `fg.onBrandSolid` | white | white | Static. This is the job `background` used to do on the Button |
| `fg.brand` | pine 800 | pine 700 | The step nearest the background that clears 4.5:1 on every layer in its mode. The old `brand` green (pine 700) measures under 4.5:1 on white |
| `fg.brandContrast` | pine 900 | pine 900 | Brand text with more weight, and text on `bg.brandWeak`. In light it is the CTA's green, which is what the deep-green text across the app has always been |
| `bg.brandWeak` / `Pressed` | pine 100 / 200 | pine 200 / 300 | SEED's weak steps in light. Pine and green share a hue, and at dark 100 their chroma is too low to tell apart, so a brand callout drew the same green as a positive one. One step further out it reads as the brand. `fg.brand` still clears 4.5:1 on it |
| `stroke.brandSolid` | pine 900 | pine 900 | SEED draws the brand line at the step of `fg.brand-contrast`, so a selected card's outline matches its text |
| `stroke.brandWeak` | pine 300 | pine 300 | SEED's weak line step |

The test is the live check, and its failure messages print each ratio. At the time of writing, the white label measured about 11.9:1 on the light CTA, 5.4:1 on the dark CTA and 3.9:1 on the dark pressed fill. `fg.brand` measured 5.9:1 on white and 6.5:1 on the dark default layer.

`brandDark` (pine 1000) did not become a role. It lightens in dark like every step, so a surface that must stay dark in both modes reads a palette value instead of that name.

### 4. Neutral solid sits one step nearer the background than SEED's

`bg.neutralSolid` is grey 800 in light, where SEED uses 900, because SDS's neutral button (`Button type="dark"`) has always filled with that step. Its pressed step moves toward the background in both modes, as SEED's does, since the solid is already the far end of the scale.

### 5. One source for the scheme, pinned to light for now

- **`SDSProvider` decides.** Its `ColorSchemeProvider` resolves the app's policy against what the OS reports, once. The policy is SEED's `colorMode`: `'system'`, `'light-only'` or `'dark-only'`. Everything reads the answer through `useResolvedScheme()`. A lint rule in `eslint.config.js` forbids importing React Native's `useColorScheme` anywhere else, and `useShadow` no longer calls it.
- **The default is `light-only`, and the app passes nothing.** `userInterfaceStyle: "light"` in `apps/mobile/app.config.ts` stays, so the OS also reports light. A nested `ColorSchemeProvider` can pin a subtree, which is how a surface that is always dark will be built.
- **Both modes resolve at load, as SEED's Lynx build does.** `createThemedStyles(f)` builds the light and the dark StyleSheet when the module loads and returns a hook that picks one. `useSemanticColors()` returns the roles for a color handed over as a prop. A color read at module scope never follows the scheme.
- **The older APIs became layers over this one.** `useAdaptive()` returns the TDS names in the resolved scheme, and `AdaptiveColorProvider` is a `ColorSchemeProvider` pinned to one scheme. `ThemeProvider` and `useTheme()` take the button theme from the roles. Each says in its JSDoc where new code goes.

### 6. A press draws a token

The Button reads its colors per tone from the roles (`packages/sds/src/core/buttonColors.ts`). Pressing fades the surface to the `-pressed` token under the label, which keeps its color. This is SEED's rule that a press changes the surface only, and nothing derives from a seed hex any more.

## Consequences

- **Light rendering stays as it was, with these exceptions.**
  - The Button's press is now visible. The surface moves to its `-pressed` token, where the old alpha overlay of the fill's own color changed nothing.
  - The force-update screen's button filled with the success green, and the web view's retry button and the campus suggestion card's action filled with the mid brand green. All of them now fill with `bg.brandSolid`.
  - The header icon PNGs are now baked from the tokens (`apps/mobile/scripts/export-header-icons.mjs`), so they picked up the palette's current grey and blue.
- **Every literal of the CTA green is a role**, read through `useSemanticColors()` or `createThemedStyles()` so it follows the scheme. The Android adaptive icon background in `app.config.ts` keeps its fixed value, since it is native and brand identity rather than theme. So does a 12% alpha tint in the onboarding step, which sits on a static card and moves to a role with it.
- **Most of the app still reads static `SdsColors`, which stays light.** Moving those reads to roles is the next stage, paired with a lint ratchet. `SdsColors` points new code at the roles in its JSDoc and is not deprecated yet.
- **Turning dark mode on comes after that migration.** `SDSProvider` takes `colorMode="system"`, and `userInterfaceStyle` becomes `"automatic"`, a native change under the version rules in `CLAUDE.md`. The values handed to native outside StyleSheet need their dark form as well, among them the header and tab PNGs, the status bar, navigation tints, map markers and web view backgrounds. The pages the app loads in a web view would take the resolved scheme over the bridge.
- **The roles are not yet shared with the web.** The `design.colors` contract vendors `colors.ts` only. Sharing `semanticColors.ts` is a separate contract change in the umbrella.

## Related

- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): the palette, the semantic layer and the API that reads it
- `packages/shared/src/tokens/semanticColors.ts`: the roles, each with its use in JSDoc
- `packages/shared/src/tokens/__tests__/semanticColors.test.ts`: the brand steps, light parity and the contrast pairs
- `packages/sds/src/core/ColorSchemeProvider.tsx` and `packages/sds/src/core/theme.ts`: the scheme source and the reading API
