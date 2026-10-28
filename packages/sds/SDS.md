---
title: SDS Design System Notes
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# SDS (Skku Design System)

> How the SDS tokens and components work where the code cannot say it: the rules a reader would undo, the `sds/*` lint rules every lint message cites, and the behaviors the product decided. When to use which part is [design-usage.md](../../docs/reference/design-usage.md), and the words on screen are [ux-writing.md](../../docs/reference/ux-writing.md).

SDS is ported from `@toss/tds-react-native` version 2.0.2 (the license history is in the root `NOTICE`) and names its tokens and APIs after SEED Design (daangn/seed-design). The decisions are ADRs 0011 to 0019 in `docs/decisions/`. What SDS exports is `src/components/index.ts`, and each prop is typed in its component. SDS animates with `react-native-reanimated` alone, on the UI thread, where TDS used `@react-spring/native`: a TDS spring config or bezier maps one to one onto `withSpring` or `Easing.bezier()`.

## Palette

The palette is `SdsPalette` in `packages/shared/src/tokens/colors.ts`, on SEED's steps, each step holding a light and a dark value. A step number is the distance from the background, not a lightness: 1000 is the darkest step in light and the lightest in dark. One step reads at about the same contrast in every chromatic hue, which is what lets a role take the same step whatever its hue.

The values came from TDS's by these rules, so aligning one with SEED's by hand undoes a decision:

1. **Placement.** Each TDS color takes one step of the matching SEED hue, in TDS's order. Where several placements fit, the one that adopts the most SEED values wins, then the one whose steps best match the colors' contrast against white.
2. **Adoption.** A color within ΔE00 3 (CIEDE2000) of SEED's value at its step takes SEED's value, light and dark, unless that would carry it across 3:1 or 4.5:1 against white. The measured distances leave a gap around 3, so a nearby threshold picks the same colors.
3. **Kept values.** A color further away keeps its SDS value in light and takes SEED's dark value for its step.
4. **Empty steps.** An empty step of a hue SEED has takes SEED's value. SEED has no orange or teal, and the brand is not SEED's, so the empty steps of `orange`, `teal` and `pine`, and all their dark values, are generated: the luminance is the mean of SEED's chromatic hues at that step, the hue comes from the SDS colors either side, and the chroma follows the nearest SEED hue's curve.

`pine` holds the brand greens and `green` the positive one, as SEED keeps its brand palette apart from `green`: re-tinting the brand must not re-tint success, and the two collide at step 100. The brand's steps are ADR 0011 section 3.

`colors.ts`, `typography.ts`, `spacing.ts` and `radius.ts` are vendored byte for byte into skkuverse-web and skkuverse-mini by the `design.*` contracts in the umbrella's `contracts/manifest.json`. They import nothing, and a change reaches those repos as a freshness PR once it lands on `main`.

## Semantic colors

The roles are `packages/shared/src/tokens/semanticColors.ts`, a file of its own because `colors.ts` imports nothing. A name follows SEED's grammar of property, role, variant and state (ADR 0011 section 1). The names whose meaning the grammar does not give away:

| Name | Means |
| --- | --- |
| `faint` | Lighter than disabled, for a glyph that only marks a control, such as an input's clear icon |
| `inverted` | The scheme turned around: `bg.neutralInverted` under `fg.neutralInverted` |
| `contrast` | Stronger text: brand text with more weight, and body text on a role's `weak` fill |
| `ai` | What a model wrote or estimated: `fg.ai` for its mark and label, `bg.aiWeak` behind it |
| `toast`, `onToast*` | The toast's surface and its foregrounds. The toast is dark in both modes |
| `glassTint`, `glassControl` | The veil inside a glass card, and a control's fill resting inside a glass sheet, which `Chip` takes on its own through `useSurface()` |
| `Pressed`, `Selected` | States, on surfaces only: a press changes the surface and leaves the label alone |

### Moving a TDS name to a role

A role names a use, so a TDS name maps by what it is doing at the call site, not by its value. Where a role keeps the light value, the move changes nothing on screen today. A TDS name and its step rarely share a number (`grey100` is `grey[200]`), so read the step from `sdsColorSteps` in `colors.ts`.

| TDS name | Role, by use |
| --- | --- |
| `grey900` / `grey700` / `grey600` as text | `fg.neutral` / `fg.neutralMuted` / `fg.neutralSubtle` |
| `background` | `bg.layerDefault` as a surface. As the label on a solid fill it is `fg.on*Solid`, which stays white in dark |
| `grey100` as a fill | `bg.neutralWeak` for a control or chip, `bg.layerBasement` for the ground under the layers. The two match in light and part in dark |
| `red500` | `fg.critical` as an icon or bold text, `bg.criticalSolid` as a fill |
| `greyOpacity*` | `bg.transparentPressed` / `Selected`, or `stroke.neutralSubtle` / `Muted`. A role is black at an alpha in light and white at an alpha in dark |
| `brand` | `fg.brand`, one step darker in light: the old green falls short of 4.5:1 on white. As the default of a route or map color, `bg.dataBrand`, which keeps the old green |
| `brandDark` | No role. It lightens in dark, so a surface that must stay dark reads a palette value |
| `scrim` / `scrimGlass` | `bg.overlay` / `bg.overlayMuted` |
| `grey300` | `stroke.neutralWeak` as a line, a sheet handle's bar or the Switch's off track, `fg.neutralFaint` as an input's clear icon |

## Reading colors

The scheme is decided in one place and both modes resolve once, when the modules load. `SDSProvider colorMode` is the app's policy (`'system'`, `'light-only'` or `'dark-only'`, `'light-only'` by default), and `ColorSchemeProvider` resolves it against the OS; a nested one pins a subtree, as a map pins `light-only` or a dark ground pins `dark-only`. `useResolvedScheme()` is the scheme rendered there. `createThemedStyles(({ color }) => styles)` builds both StyleSheets at load and returns a hook that picks one, `useSemanticColors()` gives the roles for a color handed over as a prop, and `Txt color` takes the role name.

Dark mode stays off while `userInterfaceStyle` is `"light"` in `apps/mobile/app.config.ts` and `SDSProvider` keeps its default. ADR 0011 says what turning it on takes.

## Typography

The scale is `SdsTypeScale` and the text styles `SdsTypo` in `packages/shared/src/tokens/` ([ADR 0012](../../docs/decisions/0012-name-type-scale-in-seed-direction.md)). `Txt` takes the step (`typography`) and the weight (`fontWeight`) apart, as SEED's `Text` does.

- **Only the numbering is SEED's.** From `t5` up a step's size differs from SEED's step of the same number, so a size is read from `SdsTypeScale`, never from SEED by its name.
- **A display figure larger than `t13`**, the top step, is React Native's `Text` spread from `SdsTypo.t13Bold` with its own size, behind a one-line `sds/no-rn-text` disable that gives the reason, until the scale has a display step.

## Pressable

Anything pressed turns its surface to the role's `-pressed` pair and shrinks by a fixed distance ([ADR 0014](../../docs/decisions/0014-give-press-feedback-by-surface-color-and-distance.md)). `Pressable` gives that to one element.

- **The surface goes in `bg`, as a role.** A fill drawn inside a `Pressable` to dodge `bg` gets no press: the fills a control commonly sits on, `layerBasement`, `neutralMuted`, `neutralInverted` and `overlay` among them, all have a pair. With no `bg` the element only shrinks.
- **Inside a glass sheet a layer fill paints nothing.** `Sheet` provides `useSurface()` to its content and footer (`glass` inside `surface="glass"`, `opaque` elsewhere), so a `bg` of `layerDefault` or `layerFloating` resolves to `transparent` there and presses as `transparentPressed`. Every other role is kept. A view that paints a panel of its own reads `useSurface()` and drops it the same way (COLOR-12).
- **Touch on one element, motion on another** (the Button's shape) is `usePressFeedback`. Spread its `triggerProps` on React Native's `Pressable`, which `sds/no-rn-pressable` allows in a file that calls the hook, put `targetAnimatedStyle` and `surfaceAnimatedStyle` on the views that move, and wrap the content in `PressableScopeContext.Provider value={press.scope}` so a nested pressable does not scale again.

## Recipes

A component's styles are a recipe, after SEED's slot recipes (ADR 0014 section 3): its slots in `base`, what each variant value and each `compoundVariants` entry adds, and a default for every variant, with states as `true` / `false` variants. `components/chip/chipRecipe.ts` is the pattern, and `components/button/buttonRecipe.test.mts` its test.

- **A recipe module imports types only**, because its `node --test` cannot resolve an extensionless import. Every token comes from its `RecipeTheme` argument (`color`, `spacing`, `radius`), and the test passes stand-ins.
- **`as const` on the definition** keeps the style literals (`'row'`, `'center'`) a StyleSheet needs. `createRecipe` checks the rest: a variant, value or slot that does not exist is a compile error, and so is a variant named `style`, which a compound reserves.
- **Order:** `base`, then each variant in definition order, then each matching compound in order. A compound key may list several values.
- **The press is the hook's, not the recipe's.** The resting surface and `Pressable`'s `bg` are read from one table (`CHIP_SURFACE`, the Button's `BUTTON_ROLES`) so they cannot disagree. A root slot reaches `Pressable` through `pressableSlot()`, which leaves the surface to `bg`, and a text slot reaches `Txt` through `txtSlot()`, which leaves the type to `typography` and `fontWeight`. A recipe's `pressed: true` is for what the press does not animate.
- **Every recipe exports its `variantMap`**, from which the state catalog lays out every combination; `useRecipe.resolve(scheme, selection)` resolves one outside a render.

## Component API vocabulary

Components name their axes after SEED (`tone` for meaning, `variant` for the treatment, `size` as a word step), split into parts by behaviour, and take a color only as a role. The vocabulary is [ADR 0015](../../docs/decisions/0015-name-component-apis-in-seed-vocabulary.md). [ADR 0019](../../docs/decisions/0019-clean-up-the-sds-api-without-aliases.md) lists each older component's rename, made without aliases, so an old prop name in a diff is a type error to fix, not a deprecation. State props go through `useControllableState` (`src/utils/`), and `components/seedComponents.typetest.tsx` pins every combination that must not compile.

A filter chip that opens a sheet is a `Chip.Toggle`, checked while its filter narrows the list, with a caret in `Chip.SuffixIcon`. Its `onCheckedChange` opens the sheet, and the choice is made there.

## Lint rules

The local ESLint plugin (`scripts/eslint/plugin-sds.cjs`) rejects every way of bypassing the roles, the scales and the SDS parts. Each `sds/*` message names what to use instead and the usage rule it enforces (the last column, linked to the rule in [design-usage.md](../../docs/reference/design-usage.md)), so a CI failure or a gate block reads on its own. The rules run at error over a recorded backlog: `eslint-suppressions.json` holds the violations that already exist, may only shrink, and `yarn sds:report` prints its totals. The day-to-day loop and the three ways to make an exception are [the ratchet how-to](../../docs/how-to/work-under-the-lint-ratchet.md); the mechanism is [ADR 0016](../../docs/decisions/0016-ratchet-lint-debt-with-bulk-suppressions.md).

The rules govern the React Native UI code, `apps/mobile/app`, `apps/mobile/src` and `packages/sds/src`, tests aside. Token files, `bridge`, native config and build scripts are outside them. `eslint.config.js` is where each rule's scope is set.

| Rule | Rejects | Use instead | Usage rule |
| --- | --- | --- | --- |
| `sds/no-color-literal` | A hex, `rgb()` or `hsl()` string anywhere, and a CSS color name where a color goes. `'transparent'` passes | A role through `useSemanticColors()` or `createThemedStyles()` | [COLOR-01](../../docs/reference/design-usage.md#color-01), [COLOR-20](../../docs/reference/design-usage.md#color-20) |
| `sds/no-color-in-string` | A color inside a longer string: injected CSS, a `boxShadow`, SVG markup | A role value interpolated into the string | [COLOR-01](../../docs/reference/design-usage.md#color-01) |
| `sds/no-sds-colors` | A static `SdsColors` read, under any alias | A role; "Moving a TDS name to a role" above maps each name | [COLOR-01](../../docs/reference/design-usage.md#color-01), [COLOR-20](../../docs/reference/design-usage.md#color-20) |
| `sds/no-static-theme` | `SdsSemanticColors.light` / `.dark`, an `SdsPalette` step, `colorSeeds`, `resolve*Colors()`, `getAdaptiveColors()` | `useSemanticColors()` or `createThemedStyles()`. `SdsPalette.static.*` passes | [COLOR-01](../../docs/reference/design-usage.md#color-01), [COLOR-20](../../docs/reference/design-usage.md#color-20) |
| `sds/no-use-adaptive` | `useAdaptive()` in an SDS component | A role | [COLOR-01](../../docs/reference/design-usage.md#color-01) |
| `sds/role-placement` | A role on a property of another kind: `fg` on a background or border, `bg` on text or a border, `stroke` on text. A `stroke` role may fill a divider View | The matching family: `fg` for text and icons, `bg` for surfaces, `stroke` for lines | [COLOR-03](../../docs/reference/design-usage.md#color-03) |
| `sds/no-fixed-scheme` | `light` or `dark` written into a scheme prop (`StatusBar style`, `tint`, `barStyle` and the like) | A value derived from `useResolvedScheme()` | [COLOR-20](../../docs/reference/design-usage.md#color-20) |
| `sds/no-rn-text` | React Native's `Text` and `Animated.Text`, found by import, so an alias is caught and SVG text is not | `<Txt typography fontWeight>` | [TYPE-01](../../docs/reference/design-usage.md#type-01) |
| `sds/no-type-size-literal` | A numeric `fontSize`, `lineHeight` or `letterSpacing` | A step: `Txt typography`, or `...SdsTypo.t{n}{Weight}` | [TYPE-01](../../docs/reference/design-usage.md#type-01) |
| `sds/no-font-weight-literal` | A literal `fontWeight` in a style. A `{ typography, fontWeight }` table passes | `Txt fontWeight`, or `...wantedSans('<weight>')` | [TYPE-01](../../docs/reference/design-usage.md#type-01) |
| `sds/no-font-family-literal` | A literal `fontFamily` | `Txt`, `SdsTypo` or `wantedSans()`; `Tossface` for emoji | [TYPE-01](../../docs/reference/design-usage.md#type-01) |
| `sds/no-spacing-literal` | A non-zero numeric padding, margin or gap, on the scale or off it | `SdsSpacing.x*`; the message names the step, or the nearest one | [SPACE-01](../../docs/reference/design-usage.md#space-01) |
| `sds/no-radius-literal` | A non-zero numeric radius; 999, or half the element's size, as a pill | `SdsRadius.r*`, or `SdsRadius.full` for a pill | [RADIUS-01](../../docs/reference/design-usage.md#radius-01) |
| `sds/no-rn-pressable` | React Native's `Pressable`, `Touchable*` and `Button`, and the gesture-handler and bottom-sheet touchables | `Pressable` with `bg`. React Native's `Pressable` passes in a file that calls `usePressFeedback` | [PRESS-01](../../docs/reference/design-usage.md#press-01) |
| `sds/no-press-opacity` | An opacity or a scale keyed on `pressed`, and `activeOpacity` | `Pressable` with `bg` | [PRESS-02](../../docs/reference/design-usage.md#press-02), [PRESS-07](../../docs/reference/design-usage.md#press-07) |
| `sds/no-rn-primitive` | `ActivityIndicator` and React Native's `Switch` | `Loader` and `Switch` | [LOAD-03](../../docs/reference/design-usage.md#load-03), [SEL-01](../../docs/reference/design-usage.md#sel-01) |
| `sds/no-vector-icons` | `@expo/vector-icons` and `react-native-vector-icons` | `phosphor-react-native` | [ICON-01](../../docs/reference/design-usage.md#icon-01) |
| `sds/android-accessibility-role` | An `accessibilityRole` string React Native on Android throws on (`tabbar`), read from the installed `ReactAccessibilityDelegate.kt`. A branch behind `Platform.OS === 'ios'` or a `Platform.select` `ios` key passes | A role Android lists (`tablist` for a tab bar), with the iOS-only value behind a platform branch | [A11Y-07](../../docs/reference/design-usage.md#a11y-07) |
| `sds/no-entering-over-glass` | A Reanimated `entering` on an element with a `Glass*` element written inside it in the same file | The glass mounted plainly; `exiting` alone fades it out | [MOTION-04](../../docs/reference/design-usage.md#motion-04) |
| `sds/no-raw-shadow` | A shadow spelled out: `shadowOpacity`, `shadowRadius`, `shadowOffset`, `elevation`, `boxShadow` | An `SdsShadows` level | [ELEV-04](../../docs/reference/design-usage.md#elev-04) |
| `sds/no-handbuilt-part` | A component named like a chip, a banner or an empty or error state in a file that does not use the SDS part, and a retry label rendered by hand, in app code. A heuristic: a tripwire, not a guarantee | `Chip`, `Callout` / `ActionableCallout` / `DismissibleCallout`, `ResultSection` | [CHIP-01](../../docs/reference/design-usage.md#chip-01), [CALLOUT-07](../../docs/reference/design-usage.md#callout-07), [RESULT-01](../../docs/reference/design-usage.md#result-01) |
| `sds/no-role-cast` | A cast to a role type (`as FgColorName`, `as SdsColor`) in app code | A role, or `asSdsColor()` with a reason for a data color | [COLOR-01](../../docs/reference/design-usage.md#color-01) |
| `sds/recipe-type-imports` | A value import in a `*Recipe.ts` | Tokens from the `RecipeTheme` argument ("Recipes" above) | — |
| `sds/require-disable-reason` | Any disable with no reason or too short a one, a disable that names no rule, a block or file-wide disable of an `sds/*` or `arch/*` rule, and an inline config comment that sets one | `// eslint-disable-next-line <plugin>/<rule> -- <reason>`, or a registry entry | — |
| `no-restricted-imports` | A deep import into `@skkuverse/sds` or `@skkuverse/shared`; `Result`, `ErrorPage` and the TDS theme layer (`useAdaptive`, `AdaptiveColorProvider`, `colorSeeds`, `getAdaptiveColors`); `useColorScheme` | The package index, `ResultSection`, a role, `useResolvedScheme()` | [RESULT-01](../../docs/reference/design-usage.md#result-01), [COLOR-01](../../docs/reference/design-usage.md#color-01) |

Six bypasses are type errors rather than lint, pinned by `components/seedComponents.typetest.tsx`:

- **A role's value is an `SdsColor`**, a string with a brand a hex lacks, so a slot typed `SdsColor` refuses a literal. `asSdsColor()` vouches for a color that arrives as data.
- **`Pressable`'s `style` refuses `backgroundColor`**, and so does a component that forwards its own `style` to a `Pressable`. The surface is `bg`.
- **`Txt color` takes a foreground role name** (`FgColorName`), so a hex, a role's value and a vouched `SdsColor` are refused. A data color goes through `style.color`, where lint still rejects a literal.
- **`Txt fontWeight` takes the weights WantedSans draws**: regular, medium, semibold and bold.
- **`Txt style` refuses the type keys**: `fontSize`, `lineHeight`, `letterSpacing`, `fontFamily` and `fontWeight` belong to `typography` and `fontWeight`.
- **An SDS component's color prop takes a role name** (`FgColorName`, `BgColorName`), so a color string is refused. `Badge`, which also draws colors no role names (a route color), takes an `SdsColor` the caller vouches for with `asSdsColor()`.

## Decided behaviors

The product decided these on 2026-10-11, and the code holds each in one place with a test ([ADR 0019](../../docs/decisions/0019-clean-up-the-sds-api-without-aliases.md) §4).

| Component | Behavior | Where |
| --- | --- | --- |
| `Dialog` | A confirm closes only by its buttons unless `closeOnDimmerClick` opts in; an alert also closes on a dimmer tap | `components/dialog/dimmer.ts` |
| `Border` | Its lines divide items in `stroke.neutralSubtle`; `variant="height16"` is the section band | `components/border/borderRecipe.ts` |
| `Button`, `Chip` | Disabled is `bg.disabled` under `fg.disabled`, drawn through the press hook's `disabledBg` | `BUTTON_DISABLED_ROLES`, `CHIP_DISABLED` |
| `TextField` | The label stays above the input (`labelOption="sustain"`, the default); `appear` lets it rest inside until focus | `textFieldLabelFloats()` in `components/text-field/textFieldRecipe.ts` |
| `Skeleton` | `shape` (`text`, `card`, `avatar`) sets the radius, and an avatar is square; a block takes a shape or a `borderRadius`, never both | `components/skeleton/skeletonShape.ts` |
| `Toast` | Shows for `SdsDuration.toast`, `SdsDuration.toastWithAction` with a `button`, and a finger on it pauses the count; the caller sets no duration | `components/toast/toastTimer.ts` |
| `Sheet` | A glass sheet is a floating card at its low detents and opaque once it attaches at `large`, and a drag past a top detent that is a fixed height clamps there (`enableOverDrag` only when the sheet attaches); a `stops` position (a host's own vocabulary of heights, such as the map's `min / mid / max / page`) gives covered heights SDS takes its float gap off, with dynamic sizing off, a screen-reader `label` per stop, and a `page` that may only be last; a position ending in a `page` reaches the container's top edge (`endsInPage`, `largeHeightOf`) and its top is a page, square, without a grabber and with a spacer under the status bar, all three arriving over the last half of the final segment of the drag (`sheetPageRamp`, from `PAGE_RAMP_START`), while the glass turns opaque over the whole segment (`sheetPageProgress`); a caller reads the ramp to compact a header on the same schedule | `components/sheet/chrome.ts`, `components/sheet/detents.ts` |
| `Sheet` fill schedule | A `stops` position may give each stop a `fill`, 0 glass to 1 solid, and the opaque `bg.layerFloating` layer fades in over the mounted glass between neighbouring stops as the sheet is dragged (`fillByIndex`, `fillAt`), on a floating card as well as on a sheet that travels to a page; a position with no `fill` keeps the default schedule, and without Liquid Glass every stop is opaque | `components/sheet/chrome.ts`, `components/sheet/StuckSheetBackground.tsx`, `components/sheet/ExpandableSheetBackground.tsx` |
| `Sheet` motion | A sheet that takes over another's place (the shared map's tab switch) starts from that sheet's height through `snapToPosition` on the ref and moves to its own with `SHEET_TAB_SWITCH`, gorhom's own iOS default timing (expo easing, 250 ms), so the move reads like the sheet's own snaps | `components/sheet/motion.ts` |
| `SdsShadows` | `level1` (a mark over busy content), `level2` (a floating control), `level3` (a floating panel or capsule); `glassFloat` is `level2` beside real glass, and `segmentedIndicator` is the one in-control lift | `packages/shared/src/tokens/shadows.ts` |
