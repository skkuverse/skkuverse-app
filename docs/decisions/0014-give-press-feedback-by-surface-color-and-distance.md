---
title: Give Press Feedback by Surface Color and Distance
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0014. Give press feedback by the surface color and a distance-based scale, never opacity

> Why a press in SDS turns the surface to its `-pressed` token and shrinks the element by a fixed distance, and why React Native's `Pressable` triggers it. It also says why component styles are now recipes. Read this before you give anything a pressed state or write a component's styles.

## Status

Accepted on 2026-10-10. `Pressable`, `usePressFeedback` and `createRecipe` are in `@skkuverse/sds`, and the Button is the first component on them. The press feedback the app draws by hand, and the other SDS components, move later.

## Context

[ADR 0011](0011-adopt-seed-color-token-structure.md) gave every surface role a `-pressed` pair after SEED Design (daangn/seed-design). Nothing drew presses with them consistently.

- **Presses came in many shapes.** The Button sprang to 96% when inline and not at all when block or full, under a fading overlay. Elsewhere a press dimmed the whole element with opacity, at a handful of different values, and much of the app hand-rolls its own.
- **SEED treats a press as one reaction.** Its feedback foundations make color the base: the surface changes and the label and icons do not, because a fading label reads as disabled. Scale is added where the shape allows, by a fixed distance rather than a ratio. Both take the same 150 ms, so they read as one reaction. Opacity appears in SEED's component specs only for disabled.
- **SEED's Lynx build is the nearest runtime to React Native.** `usePressTap` keeps a `pressed` state on the background thread, `useScaleFeedback` measures and animates on the main thread, and the trigger and the animated target are separate props.
- **The next components need a base.** Chip, Callout and a result section need a pressable that behaves the same everywhere, and a way to write their styles that a catalog can enumerate.

## Decision

### 1. A press is the surface's `-pressed` token and a fixed-distance shrink

| Rule | Detail |
| --- | --- |
| Color | The surface turns from its role to the `-pressed` pair (`bg.brandSolid` → `bg.brandSolidPressed`). Text and icons keep their color, and nothing fades |
| Color input | A role name only. `PressableBgToken` admits only roles with a `-pressed` pair, so `bg: 'disabled'` is a type error. A static color (the light Button) gives no color feedback |
| Scale | `scale = (basis − 2) / basis` with `basis = max(height, width / 4, 24)`: every element sinks by 2pt of its basis. A fixed 0.98 would move a wide button nine times further than a chip |
| Constants | The scale's three numbers are code constants in `packages/sds/src/core/pressFeedback.ts`, not tokens. SEED keeps them out of its tokens on purpose: they shape every pressable, and a token can be redeclared per element |
| Timing | Color and scale share one progress, over `SdsDuration.fast` (SEED's d3) on `SdsCurves.pressed` (SEED's `pressed-scale` curve, added for this) |
| Disabled, loading | No feedback, and a press in progress is released, as Lynx's `usePressTap` does |
| Reduce motion | The scale stays at 1 and the color still changes. The setting is read live through `AccessibilityInfo`: Reanimated's own flag is set once at launch, and its default `ReduceMotion.System` would snap the color as well, so the timing passes `ReduceMotion.Never` and the policy keeps the scale at 1 |
| Nesting | An element inside one that scales does not scale again (`PressableScopeContext`), and keeps its color |
| Color as state | `feedback="scale"` for an element whose color already shows its state (a switch, a selected tab), so the press never looks like the state changing early |
| Scope | Self scale shrinks the whole element. Content scale keeps a full-width surface still and shrinks what is inside; the hook's target style goes on an inner wrapper |

### 2. React Native's `Pressable` triggers it; Reanimated runs it

The animation runs on the UI thread either way (`withTiming` on a shared value). The choice is what starts it.

| | RN `Pressable` callbacks (chosen) | Gesture-handler gesture with worklet callbacks |
| --- | --- | --- |
| Press-in starts | When the JS thread takes the event. Pressability fires `onPressIn` on responder grant, with `delayPressIn` 0 | On the UI thread |
| Screen reader activation, long press, `hitSlop`, cancellation by a parent scroll view | Built in | Rebuilt by hand |
| Inside a React Native `Modal` on Android | Works | Needs a gesture-handler root view inside the modal (`RNGestureHandlerRootView.kt`: a modal's `DialogRootViewGroup` sits outside the app's root). SDS Buttons render inside such modals today |
| The Button's props | `PressableProps`, unchanged | A different surface |

Gesture-handler's own `Pressable` makes the same trade: it sets `runOnJS(true)` on its gestures (`src/components/Pressable/Pressable.tsx`). The cost is that a busy JS thread delays the start of a press; revisit with a measured lag, not before.

### 3. A component's styles are a recipe

After SEED's slot recipes, with states as boolean variants as in its Lynx preset:

- **One definition per component.** Slots in `base`, what each variant value adds, what a combination adds (`compoundVariants`), and a default for every variant. `pressed`, `selected` and `disabled` are `true` / `false` variants.
- **Built at load, picked at render.** `createRecipe` evaluates the definition for both schemes when the module loads, as `createThemedStyles` does. A render resolves a selection, cached per scheme and selection.
- **Pure and testable.** A recipe is a function of a `RecipeTheme` (color, spacing, radius) in its own module that imports types only, so its test runs it under `node --test` with stand-in tokens.
- **Typed from the definition.** A wrong variant, value or slot is a compile error at the call and in the definition. `packages/sds/src/core/recipe.typetest.ts` pins each case.
- **Enumerable.** Each recipe exposes its `variantMap`, the input for a catalog grid.
- **SEED's boundary for literals.** Padding, gap and radius are tokens; sizes, heights and line widths may be numbers.

### 4. The Button is the proof

The Button moved onto `buttonRecipe` and `usePressFeedback` with its props unchanged.

- **The resting look is the same.** `buttonRecipe.test.mts` pins every size, display and disabled state to the numbers the old Button drew, and a simulator capture of a weak Button matched the earlier capture pixel for pixel at rest and after release. `type="light"` changed afterwards. TDS draws it for a dark ground, with a dark label on its fill and a white veil for its weak variant. The port had a white label on both.
- **The press is SEED's.** Every tone presses to its `-pressed` surface and shrinks by distance, at every display. A full-width button keeps its surface and shrinks its content. The light button has no role in either variant, so it only shrinks.
- **The tone table is one place.** `BUTTON_ROLES` in `components/button/buttonRecipe.ts` names each tone's surface and label roles. The recipe draws from it and the press reads the same surface name.

## Consequences

- **Every Button presses differently.** A block or full button now shrinks, an inline one shrinks by distance instead of 4%, and the surface fades on a curve instead of a spring.
- **Opacity presses remain until they move.** The app's hand-rolled feedback and the other SDS components still dim with opacity until each moves onto `Pressable`.
- **`ThemeProvider` no longer reaches the Button.** No caller passed an override, so nothing on screen changed. `ThemeProvider`, `useTheme()` and `SDSProvider`'s `token` remain for their types, read by nothing in SDS, and belong to the naming cleanup.
- **A press re-renders its component once in and once out**, for the `pressed` state a recipe may select on. The surface and the scale do not wait for it.
- **A recipe module imports types only.** It cannot call a runtime helper from another file, because `node --test` cannot resolve an extensionless import. That is why a definition is a plain function and `createRecipe` does the checking.

## Related

- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): the Pressable and Recipes sections
- `packages/sds/src/core/pressFeedback.ts`, `usePressFeedback.ts`, `recipe.ts`, `createRecipe.ts`
- [ADR 0011](0011-adopt-seed-color-token-structure.md): the `-pressed` roles, [ADR 0013](0013-name-spacing-and-radius-after-seed.md): the spacing and radius a recipe reads
