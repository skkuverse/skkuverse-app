---
title: Design Usage Rules
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Design Usage Rules

> When to use which token, component and pattern in the app's UI, each rule under a stable ID. Read it before you build or review a screen. Lint, types and tests enforce part of it, and for those rules this page only points at the code that does.

## How to read this guide

- **One home per rule.** This page says *when* to use something. [`packages/sds/SDS.md`](../../packages/sds/SDS.md) says *how* a component or token works, and [ux-writing.md](ux-writing.md) holds every rule about words. No rule is written in two of them.
- **Every rule has an ID** such as `COLOR-01`, and its anchor is the ID in lower case (`design-usage.md#color-01`). The IDs carry over from the research catalog the rules were drawn from, and the `sds/*` lint messages cite them.
- **A rule that code enforces is one line** naming the rule and the code that checks it, which is an `sds/*` rule in the [lint rules table](../../packages/sds/SDS.md#lint-rules), a type pinned by `packages/sds/src/components/seedComponents.typetest.tsx`, or a test named by path. The line never restates the selector or the type. A rule marked "not enforced yet" could be checked by code but is not yet, so review it by hand until a check exists.
- **Every other rule needs judgment** and is checked in review, by a person or an agent.
- **A rule names the token, never its value** (`SdsSpacing.x5`, `bg.layerDefault`, `t10`), and the token file holds the value. A number appears only where no token or code holds it, so this page is its source.
- **Decided but not built yet.** A rule that depends on a token or component the code does not have yet links its entry under [Open items](#open-items).

## To draw X, use Y

| To draw | Use | Not |
| --- | --- | --- |
| Text | `Txt` with `typography` and `fontWeight`, or a `SdsTypo` style | React Native's `Text`, a numeric `fontSize` |
| An emoji | `Tossface`, sized with its `size` prop | A bare `fontFamily`, a `fontSize` in its style |
| A color | A role through `useSemanticColors()` or `createThemedStyles()` | A hex, `SdsColors`, a palette step |
| Padding, margin, gap | `SdsSpacing.x*` | A number |
| A corner | `SdsRadius.r*`, or `SdsRadius.full` for a pill | A number, `999` |
| Anything pressable | SDS `Pressable` with `bg`, or `usePressFeedback` | React Native's `Pressable`, `Touchable*`, opacity |
| A button | `Button`; `TextButton` for a text link; `IconButton` for an icon alone | A styled `Pressable` |
| A few icon buttons floating together, a toolbar group | `GlassButtonGroup`, one 44 pt button per icon, each with its own label | `GlassIconButton`s side by side |
| A filter, an option, a suggestion | `Chip.Toggle`, `Chip.RadioItem` inside `Chip.RadioRoot`, `Chip.Button` | A hand-built pill |
| A status label | `Badge` | A colored `View` with text |
| A local tip or warning | `Callout`, `ActionableCallout`, `DismissibleCallout` | A hand-built banner |
| A page-wide banner | Nothing yet: see [Missing components](#missing-components) | |
| An empty, error or success state | `ResultSection` | A hand-built state |
| A row of information | `ListRow` under a `ListHeader` | A hand-built card |
| A divider | `Border` | A one-pixel `View` |
| Content still loading | `Skeleton` for structure, `Loader` for a wait an action caused | `ActivityIndicator` |
| Transient feedback | `Toast` | A `Callout` that disappears |
| A decision before an action | `Dialog.Confirm`; `Dialog.Alert` to acknowledge | A custom modal |
| More detail or options in place | `Sheet` | A full-screen modal |
| A setting that applies at once | SDS `Switch` | React Native's `Switch` |
| Several independent choices | `Checkbox` | A `Switch` per item |
| One of a few options | `Chip.RadioItem` for short labels; a stacked radio list is missing: see [Missing components](#missing-components) | |
| Sections of a screen | `Tab` | `SegmentedControl` |
| A filter on the content below | `SegmentedControl` | `Tab` |
| Text input | `TextField`; `SearchField` for search | React Native's `TextInput` with custom chrome |
| A completing action at the bottom | `FixedBottomCTA` | A button floating in the content |
| An icon | A `phosphor-react-native` `*Icon` | `@expo/vector-icons` |
| A shadow | An `SdsShadows` level (`level1` to `level3`), on floating elements only | `shadowOpacity` and friends |
| Monospaced or tabular figures | Nothing yet: see [Missing components](#missing-components) | |

## Foundations

### Color

Roles and their names are [ADR 0011](../decisions/0011-adopt-seed-color-token-structure.md). The API is SDS.md "Semantic colors" and "Reading colors".

- <a id="color-01"></a>**COLOR-01** · Draw every color from a role through `useSemanticColors()` or `createThemedStyles()`. Never a hex, a CSS name, `SdsColors` or a palette step. Enforced by [`sds/no-color-literal`](../../packages/sds/SDS.md#lint-rules), [`sds/no-color-in-string`](../../packages/sds/SDS.md#lint-rules), [`sds/no-sds-colors`](../../packages/sds/SDS.md#lint-rules), [`sds/no-static-theme`](../../packages/sds/SDS.md#lint-rules), [`sds/no-use-adaptive`](../../packages/sds/SDS.md#lint-rules), [`sds/no-role-cast`](../../packages/sds/SDS.md#lint-rules) and [`no-restricted-imports`](../../packages/sds/SDS.md#lint-rules) and by the `SdsColor` type and the SDS components' role-typed color props, `Txt color` among them.
- <a id="color-02"></a>**COLOR-02** · Pick a role by what the element means. Elements that share a value today still take separate roles when they mean different things.
- <a id="color-03"></a>**COLOR-03** · Use `fg.*` for text and icons, `bg.*` for surfaces and fills, `stroke.*` for lines and outlines. Enforced by [`sds/role-placement`](../../packages/sds/SDS.md#lint-rules).
- <a id="color-04"></a>**COLOR-04** · Grade neutral text by level: `fg.neutral` for primary text, `fg.neutralMuted` for secondary text (descriptions, supporting copy), `fg.neutralSubtle` for tertiary text (dates, counts, captions).
- <a id="color-05"></a>**COLOR-05** · Keep `fg.placeholder` for input placeholders and `fg.disabled` (on `bg.disabled`) for disabled controls. Neither is a lighter grey for readable text.
- <a id="color-06"></a>**COLOR-06** · Use the brand roles for brand elements and for the screen's most important action, whose fill is `bg.brandSolid` with `fg.onBrandSolid`.
- <a id="color-07"></a>**COLOR-07** · Show success and confirmation with `positive`, never `brand`.
- <a id="color-08"></a>**COLOR-08** · Map status to role: `critical` for errors and problems that need attention now, `warning` for caution, `informative` for help and state descriptions, `positive` for success.
- <a id="color-09"></a>**COLOR-09** · Pick the variant by emphasis: `-weak` for low emphasis (banners, callouts, selected rows), `-solid` for high emphasis (the action, a strong badge).
- <a id="color-10"></a>**COLOR-10** · Put `fg.on{Role}Solid` on a `bg.{role}Solid` fill, read from one table. Enforced by the component recipes' role tables and the pair contrast in `packages/shared/src/tokens/__tests__/semanticColors.test.ts`.
- <a id="color-11"></a>**COLOR-11** · On a `bg.{role}Weak` surface, write text in `fg.{role}Contrast`. At body size a status color is always its `-Contrast` step. Plain `fg.{role}` is for icons and large or bold text, which WCAG 2.x holds to the lower threshold (A11Y-01). The pairs are enforced by `semanticColors.test.ts`. The usage is review.
- <a id="color-12"></a>**COLOR-12** · Stack surfaces by layer: `bg.layerBasement` is the deepest ground, `bg.layerDefault` the surface for page content (lists, cards, fields, the header), `bg.layerFloating` the temporary modal layer (sheets, dialogs, menus). Content on a sheet paints no layer fill of its own: the sheet is the layer, and on a glass sheet a second copy is an opaque block on the glass. SDS `Pressable` drops a layer `bg` there by itself. A hand-drawn panel reads `useSurface()`.
- <a id="color-13"></a>**COLOR-13** · Use a layer role only as a container's background, never on text or an icon. Enforced by [`sds/role-placement`](../../packages/sds/SDS.md#lint-rules).
- <a id="color-14"></a>**COLOR-14** · Use `bg.layerBasement` for the screen background behind layers, and `bg.neutralWeak` for a grey fill that keeps its tone at any elevation (controls, chips, inputs).
- <a id="color-15"></a>**COLOR-15** · Set an area apart on `bg.layerDefault` with `bg.neutralMuted`, and an area on a grey ground with `bg.neutralSubtle`.
- <a id="color-16"></a>**COLOR-16** · Draw an element's own outline (a card, an input, an outline button) with `stroke.neutralWeak`.
- <a id="color-17"></a>**COLOR-17** · Separate units of meaning (section from section, content from the action area) with `stroke.neutralMuted`, which appears once or twice a screen.
- <a id="color-18"></a>**COLOR-18** · Divide repeated items of one kind (list rows, settings items) with `stroke.neutralSubtle`, which `Border`'s lines draw. Enforced for `Border` by `packages/sds/src/components/border/borderRecipe.test.mts`.
- <a id="color-19"></a>**COLOR-19** · Dim behind a modal with `bg.overlay`. Enforced by the literal ban under COLOR-01.
- <a id="color-20"></a>**COLOR-20** · Read a color inside a render, never at module scope, and derive a scheme value from `useResolvedScheme()`, so a role follows the scheme. Enforced by [`sds/no-color-literal`](../../packages/sds/SDS.md#lint-rules), [`sds/no-sds-colors`](../../packages/sds/SDS.md#lint-rules), [`sds/no-static-theme`](../../packages/sds/SDS.md#lint-rules) and [`sds/no-fixed-scheme`](../../packages/sds/SDS.md#lint-rules).
- <a id="color-21"></a>**COLOR-21** · Tint map data with the data roles. A route, pin or zone whose data names no color takes `bg.dataBrand`, and a transit stop's pin takes `bg.dataStop`, never the route's color, which a stop drawn on its own route would vanish into. The steps are in `packages/shared/src/tokens/semanticColors.ts`.

### Typography

The scale is [ADR 0012](../decisions/0012-name-type-scale-in-seed-direction.md): `t1` is the smallest and the number grows with the size.

- <a id="type-01"></a>**TYPE-01** · Set text through `Txt` (`typography` and `fontWeight`) or a `SdsTypo` style. Enforced by [`sds/no-rn-text`](../../packages/sds/SDS.md#lint-rules), [`sds/no-type-size-literal`](../../packages/sds/SDS.md#lint-rules), [`sds/no-font-weight-literal`](../../packages/sds/SDS.md#lint-rules) and [`sds/no-font-family-literal`](../../packages/sds/SDS.md#lint-rules), and by the `Txt` types: `fontWeight` takes the weights WantedSans draws and `style` refuses the size, line height, spacing, family and weight.
- <a id="type-02"></a>**TYPE-02** · Pair a size with its own line height. Enforced by `SdsTypeScale` and the `Txt typography` type.
- <a id="type-03"></a>**TYPE-03** · Make title and body visibly different levels so a screen reads in order.
- <a id="type-04"></a>**TYPE-04** · Where a role is specific (a screen title, an article body), use the style named for it below rather than a step picked ad hoc.
- <a id="type-05"></a>**TYPE-05** · Set every screen's title in `SdsTypo.t10Bold`, and a large title in `t12`.
- <a id="type-06"></a>**TYPE-06** · Set long-form body text (a notice or post body) in `SdsTypo.t6Regular`.
- <a id="type-07"></a>**TYPE-07** · Set annotations, reference notes and detail lists in `t4` regular, and never use it for general body text.
- <a id="type-08"></a>**TYPE-08** · Keep `t1` to `t7` for body and supporting text and `t8` to `t11` for titles and key text.
- <a id="type-09"></a>**TYPE-09** · Keep `t12` and `t13` out of ordinary titles. Use them for a display number or a hero heading.
- <a id="type-10"></a>**TYPE-10** · Build hierarchy with regular, medium and bold. SemiBold stays in the one `SdsTypo` style that has it.
- <a id="type-11"></a>**TYPE-11** · Let text follow the OS font size, with fixed (non-scaling) text only where a fixed box must hold it. Not followed today: see [OS font size](#os-font-size).

### Spacing and layout

The scale is [ADR 0013](../decisions/0013-name-spacing-and-radius-after-seed.md).

- <a id="space-01"></a>**SPACE-01** · Take padding, margin and gap from `SdsSpacing.x*`. Sizes and line widths may stay numbers. Enforced by [`sds/no-spacing-literal`](../../packages/sds/SDS.md#lint-rules).
- <a id="space-02"></a>**SPACE-02** · Keep one horizontal gutter between the screen edge and content on every screen, `SdsSpacing.gutter` ([ADR 0017](../decisions/0017-add-a-screen-gutter-token.md)). Some screens still inset by another value: see [Screen gutter](#screen-gutter).
- <a id="space-03"></a>**SPACE-03** · Measure the gutter from the safe-area edge, not the physical screen edge.
- <a id="space-04"></a>**SPACE-04** · Space chips `SdsSpacing.x2` apart. Not enforced yet. The gap belongs in `Chip.RadioRoot`, not in each caller.
- <a id="space-05"></a>**SPACE-05** · Separate components that bring no spacing of their own by `SdsSpacing.x3`, such as stacked components or buttons in a row, and the parts inside a card or a form the same way. Components that carry their own padding stack with no gap.
- <a id="space-06"></a>**SPACE-06** · Put `SdsSpacing.x5` between the header and a page title.
- <a id="space-07"></a>**SPACE-07** · End scrollable screen content with `SdsSpacing.x14` of bottom space.
- <a id="space-08"></a>**SPACE-08** · Stack related text (a title over its description) `SdsSpacing.x1_5` apart.

### Radius

- <a id="radius-01"></a>**RADIUS-01** · Take corner radii from `SdsRadius.r*` and draw a pill or a circle with `SdsRadius.full`. Enforced by [`sds/no-radius-literal`](../../packages/sds/SDS.md#lint-rules).
- <a id="radius-02"></a>**RADIUS-02** · Give a pressed surface the radius of its component. There is no shared pressed radius.

### Elevation and shadow

- <a id="elev-01"></a>**ELEV-01** · Assign global levels in order: `bg.layerBasement` (ground), `bg.layerDefault` (page content), a `Sheet` on `bg.layerFloating` (a new stacking context), and a `Dialog` above everything, including an open sheet.
- <a id="elev-02"></a>**ELEV-02** · Inside a surface, layer main content (lists, callouts, tabs, the header), then floating actions, then transient feedback (a toast).
- <a id="elev-03"></a>**ELEV-03** · When content scrolls under the header, leave the separation to the native-stack header and add no line or shadow of your own.
- <a id="elev-04"></a>**ELEV-04** · Separate a card from its ground by surface (`bg.layerDefault` on `bg.layerBasement`) or by `stroke.neutralWeak`, never by a shadow. Shadows are for floating elements only: floating buttons, popovers, the sheet. Take them from an `SdsShadows` level, never spelled out. [`sds/no-raw-shadow`](../../packages/sds/SDS.md#lint-rules) rejects a spelled-out shadow. Which element gets one is review. The decision is [ADR 0018](../decisions/0018-separate-cards-by-surface-not-shadow.md).
- <a id="elev-05"></a>**ELEV-05** · Give the strongest shadow only to what sits highest on the screen: `level1` for a small mark lifted off busy content, `level2` for a floating control, `level3` for a floating panel or capsule. `glassFloat` is `level2` beside a real glass surface. The levels rise in order, pinned by `packages/shared/src/tokens/__tests__/shadows.test.ts`. Which level an element takes is review.

### Motion

- <a id="motion-01"></a>**MOTION-01** · Time a micro motion (a press, a focus, a toggle) at `SdsDuration.normal` or shorter and a macro motion (a page, a modal, a sheet) longer, always from `SdsDuration`. Not enforced yet.
- <a id="motion-02"></a>**MOTION-02** · Ease a motion by its kind from `SdsCurves`, never an inline bezier. `SdsCurves` lacks the functional, exit and expressive curves. See [Missing components](#missing-components). Not enforced yet.
- <a id="motion-03"></a>**MOTION-03** · Run a press's color change and its scale on one duration and curve. Enforced by `usePressFeedback` ([ADR 0014](../decisions/0014-give-press-feedback-by-surface-color-and-distance.md)).
- <a id="motion-04"></a>**MOTION-04** · Mount Liquid Glass plainly. Never put a glass surface (a `Glass*` primitive or a `GlassView`) under a view that animates in on mount, whether by an `entering` layout animation of any kind or by an animated style that fades it in. The glass can draw nothing, and stays blank until its screen is covered and shown again. Fade such a view out with `exiting` alone. Enforced for `entering` by [`sds/no-entering-over-glass`](../../packages/sds/SDS.md#lint-rules) when the glass is written in the same file. Glass inside an imported component, and an animated style, are review.

### Press feedback and state

The mechanism is [ADR 0014](../decisions/0014-give-press-feedback-by-surface-color-and-distance.md). The API is SDS.md "Pressable".

- <a id="press-01"></a>**PRESS-01** · Give everything pressable SDS press feedback: `Pressable`, `usePressFeedback`, or an SDS component built on them. Enforced by [`sds/no-rn-pressable`](../../packages/sds/SDS.md#lint-rules).
- <a id="press-02"></a>**PRESS-02** · Never signal a press with opacity. Opacity means disabled. Enforced by [`sds/no-press-opacity`](../../packages/sds/SDS.md#lint-rules).
- <a id="press-03"></a>**PRESS-03** · Change only the surface on press. Text and icons keep their color. Enforced by the roles: no `fg` role has a pressed pair.
- <a id="press-04"></a>**PRESS-04** · Take the pressed color from the resting role's `-pressed` pair. Never define one. Enforced by the `PressableBgToken` type.
- <a id="press-05"></a>**PRESS-05** · Give an element with no resting fill `bg="transparent"`, and one on a floating layer `bg="layerFloating"`. Enforced by the `PressableBgToken` type. The choice is review.
- <a id="press-06"></a>**PRESS-06** · Where color already shows the state (a switch, a selected tab), press with scale only (`feedback="scale"`).
- <a id="press-07"></a>**PRESS-07** · Shrink by the fixed distance `usePressFeedback` computes, from the element's centre, without moving its neighbours, and never tune it per element. Enforced by `packages/sds/src/core/pressFeedback.test.mts` and [`sds/no-press-opacity`](../../packages/sds/SDS.md#lint-rules).
- <a id="press-08"></a>**PRESS-08** · Scale an element only when it reads as one surface. Never scale link text inside a sentence.
- <a id="press-09"></a>**PRESS-09** · When an element holds peer actions (open, like, save), only the pressed target reacts. When its inner control belongs to it (a switch in a row), the whole element reacts.
- <a id="press-10"></a>**PRESS-10** · Scale a full-width row's content, not its background (`scaleScope="content"`).
- <a id="press-11"></a>**PRESS-11** · Never scale an element inside one that already scales. Enforced by `pressFeedback.test.mts`.
- <a id="press-12"></a>**PRESS-12** · Keep scaling a selected element. Give a loading or disabled one no feedback. Enforced by `pressFeedback.test.mts`.
- <a id="press-13"></a>**PRESS-13** · Under Reduce Motion, drop the scale and keep the color. Enforced by `pressFeedback.test.mts`.
- <a id="press-14"></a>**PRESS-14** · A disabled element shows no other interaction state.

### Icons

- <a id="icon-01"></a>**ICON-01** · Draw UI icons from `phosphor-react-native`, and draw no new icon while the library has one. Enforced by [`sds/no-vector-icons`](../../packages/sds/SDS.md#lint-rules). Emoji are `Tossface`, a different thing, enforced by [`sds/no-font-family-literal`](../../packages/sds/SDS.md#lint-rules).
- <a id="icon-02"></a>**ICON-02** · Size icons at 24 by default and never below 12. Not enforced yet.
- <a id="icon-03"></a>**ICON-03** · Use `weight="fill"` at 16 and below. Not enforced yet.
- <a id="icon-04"></a>**ICON-04** · Use the regular weight to explain a detailed concept and the fill weight for fast recognition and for on and off states.
- <a id="icon-05"></a>**ICON-05** · Beside text, centre the icon vertically, space it on the spacing scale, and match weight: regular icons with light text, fill icons with bold text.
- <a id="icon-06"></a>**ICON-06** · Use regular icons in header buttons and fill icons in the tab bar.
- <a id="icon-07"></a>**ICON-07** · Show an on-and-off toggle as regular (default), fill (on), and the slashed icon (off), as in `BellIcon` and `BellSlashIcon`.
- <a id="icon-08"></a>**ICON-08** · Use fill icons inside a container (a button, a chip, a callout). Not enforced yet. `IconSlot` could default the weight.
- <a id="icon-09"></a>**ICON-09** · Size an icon for its context. A section title's icon is larger than a chip's, a list item's leading icon is regular, and an informative list's leading icon is small and filled.

## Components

The component APIs follow [ADR 0015](../decisions/0015-name-component-apis-in-seed-vocabulary.md), and [ADR 0019](../decisions/0019-clean-up-the-sds-api-without-aliases.md) lists the renames that brought the older components onto it.

### Button

- <a id="btn-01"></a>**BTN-01** · Give a screen at most one high-emphasis solid button (`variant="solid"`), on its most important action.
- <a id="btn-02"></a>**BTN-02** · Use `variant="weak"` for most other actions and as the secondary beside the CTA.
- <a id="btn-03"></a>**BTN-03** · Use `tone="critical"` solid only for an important irreversible action (delete, reset), mostly in a confirm dialog, and only on the button that performs it.
- <a id="btn-04"></a>**BTN-04** · Do not spread `tone="brand"` solid across a screen. It marks the one main action.
- <a id="btn-05"></a>**BTN-05** · Show hierarchy by pairing a weak button with a solid one. Weak buttons of equal rank may sit side by side.
- <a id="btn-06"></a>**BTN-06** · When the weak half of a pair dismisses (close, reset), split the pair 3:7.
- <a id="btn-07"></a>**BTN-07** · Never put three or more buttons side by side. Past two actions, put the rest behind a more button.
- <a id="btn-08"></a>**BTN-08** · Order a pair secondary left, primary right.
- <a id="btn-09"></a>**BTN-09** · Use `size="large"` mainly for the CTA, `small` or `medium` in the body, `xsmall` where space is tight.
- <a id="btn-10"></a>**BTN-10** · Stack a pair vertically at full width when a label would not fit (long, translated or enlarged).
- <a id="btn-11"></a>**BTN-11** · Give a button at most one icon, before the label, and only when it adds meaning. Enforced by the `Button` props (`leftAccessory` only).
- <a id="btn-12"></a>**BTN-12** · Use an icon-only button only where needed, and always give it a label. Not enforced yet. `IconButton`'s `label` is optional today.
- <a id="btn-13"></a>**BTN-13** · While loading, keep the button's width, show the loading mark and take no press. The press half is enforced by `pressFeedback.test.mts`. The width is not pinned yet.

### Chip

- <a id="chip-01"></a>**CHIP-01** · Use a chip to show or pick a value (a filter, an option, a suggestion, an entered keyword), built from `Chip` parts. An action that does the screen's work is a `Button`. [`sds/no-handbuilt-part`](../../packages/sds/SDS.md#lint-rules) flags a component named like a hand-built chip.
- <a id="chip-02"></a>**CHIP-02** · Use chips in groups of two or more.
- <a id="chip-03"></a>**CHIP-03** · Draw selectable chips with `variant="outlineWeak"`. Not enforced yet. The parts default to `solid`.
- <a id="chip-04"></a>**CHIP-04** · When chips switch content like tabs, give them tab semantics, and never put them beside filter chips of the same look.
- <a id="chip-05"></a>**CHIP-05** · Give a chip that shows user-entered content a remove button in its suffix.
- <a id="chip-06"></a>**CHIP-06** · When any filter in a row is active, offer a clear-all action.

### Tab and SegmentedControl

- <a id="tab-01"></a>**TAB-01** · Navigate between sections with `Tab`. Filter, sort or re-view the content below with `SegmentedControl`. A `SegmentedControl` never navigates.
- <a id="tab-02"></a>**TAB-02** · Give a `SegmentedControl` two to four segments. Beyond that, use a radio or checkbox group. Not enforced yet.
- <a id="tab-03"></a>**TAB-03** · Use at most one `SegmentedControl` per screen.
- <a id="tab-04"></a>**TAB-04** · Keep a fixed-width `Tab` under four items. From four up, set `fluid`. Not enforced yet.
- <a id="tab-05"></a>**TAB-05** · For two levels of tabs, give each level a different style.
- <a id="tab-06"></a>**TAB-06** · Show a tab's dot (`redBean`) only for new content, clear it once seen, and never on several tabs at once.
- <a id="tab-07"></a>**TAB-07** · Keep a fixed set of tabs fixed. When a tab has nothing to show or its content is over, strike it through with `disabled` instead of removing it. The row then reads the same every day.

### Checkbox, Radio, Switch

- <a id="sel-01"></a>**SEL-01** · Use SDS `Switch` only for a setting that applies at once. When nothing applies until a final button, use `Checkbox`. [`sds/no-rn-primitive`](../../packages/sds/SDS.md#lint-rules) rejects React Native's `Switch`. When to use one is review.
- <a id="sel-02"></a>**SEL-02** · Use switches for independent items only. For select-all, put a parent checkbox over child checkboxes, indeterminate when partly selected.
- <a id="sel-03"></a>**SEL-03** · Pick by the choice. A radio takes one of a few options, stacked, and `Checkbox` any of several. Chips suit short-word filters laid out in a row. Never use radios for a multi-select.
- <a id="sel-04"></a>**SEL-04** · Preselect the recommended or most common radio option.
- <a id="sel-05"></a>**SEL-05** · Stack radios vertically.
- <a id="sel-06"></a>**SEL-06** · With six or more options, or a list that will grow, show the chosen value in a field that opens a sheet listing every option.
- <a id="sel-07"></a>**SEL-07** · Choose a selection component in order: rich options, a select box. Five or more options or one-line descriptions, a select. Two to four plain options, chips or a radio or checkbox group. SDS has neither select yet: see [Missing components](#missing-components).
- <a id="sel-08"></a>**SEL-08** · Make a control's label part of its touch target, and a whole list row the target inside a row. `Checkbox` takes its label as children, but `Switch` has no label prop yet. Not enforced yet.
- <a id="sel-09"></a>**SEL-09** · In a row that carries a check, radio or switch, make the whole row one target and put no other button in it.
- <a id="sel-10"></a>**SEL-10** · Show a disabled switch's label in `fg.disabled` too.
- <a id="sel-11"></a>**SEL-11** · Use `Checkbox.Circle` for a required choice the user must notice and `Checkbox.Line` for optional choices of three or fewer.
- <a id="sel-12"></a>**SEL-12** · Give a single-select list at least two items, and never mix single and multi select in one group.

### Callout

- <a id="callout-01"></a>**CALLOUT-01** · Choose `tone` by the message: `neutral` general, `informative` tips and guides, `positive` success or a benefit, `warning` caution, `critical` a serious error or an action needed now, `ai` what a model wrote or estimated.
- <a id="callout-02"></a>**CALLOUT-02** · Use a fill icon as the prefix icon. Not enforced yet (ICON-08).
- <a id="callout-03"></a>**CALLOUT-03** · Never put a link in an `ActionableCallout`. The whole callout is the target. Enforced by its props (no `linkProps`).
- <a id="callout-04"></a>**CALLOUT-04** · Use the inline link for supplementary content only. To drive an action, use `ActionableCallout`.
- <a id="callout-05"></a>**CALLOUT-05** · Title a callout with a short category word, never a sentence, and keep the body to what the title does not already say.
- <a id="callout-06"></a>**CALLOUT-06** · Use `DismissibleCallout` only for information worth seeing once, never for a warning or an error, and never show a dismissed message again (record it under a `seen` key). Not enforced yet. Its `tone` still admits `warning` and `critical`.
- <a id="callout-07"></a>**CALLOUT-07** · Put a local message (a tip, a risk) in a callout inside the content, and page-wide status in one banner at the top, at most one per screen. [`sds/no-handbuilt-part`](../../packages/sds/SDS.md#lint-rules) flags a component named like a hand-built banner. SDS has no page banner yet: see [Missing components](#missing-components).

### Toast

- <a id="toast-01"></a>**TOAST-01** · Use a toast only for low-severity, transient feedback: the result of what the user just did, or a background task finishing. Other messages: CHOICE-01.
- <a id="toast-02"></a>**TOAST-02** · Mark the toast's nature with `Toast.Icon`: `check` for success, `error` for failure.
- <a id="toast-03"></a>**TOAST-03** · Show one toast at a time and queue the next. Not enforced yet. A single toast host would make two unrepresentable.
- <a id="toast-04"></a>**TOAST-04** · Give a toast at most one action, a text button of one or two words naming it. Offer undo after an important add or delete. Its words are in [ux-writing.md](ux-writing.md).
- <a id="toast-05"></a>**TOAST-05** · Show a toast for `SdsDuration.toast`, `SdsDuration.toastWithAction` with an action, paused while touched. Enforced by `Toast`, which takes no duration of the caller's, and pinned by `packages/sds/src/components/toast/toastTimer.test.mts`.
- <a id="toast-06"></a>**TOAST-06** · Show the toast at the bottom inside the safe area, above a fixed bottom CTA and above floating buttons.

### Dialog

- <a id="dialog-01"></a>**DIALOG-01** · Use `Dialog.Alert` to inform and get an acknowledgement, and `Dialog.Confirm` for a choice the user must make before an important or irreversible action.
- <a id="dialog-02"></a>**DIALOG-02** · Keep a dialog to two actions at most, counting close, with text that explains the action. More actions belong in a sheet.
- <a id="dialog-03"></a>**DIALOG-03** · Close a confirm dialog only through its buttons, never by a tap outside. Enforced by `Dialog.Confirm`'s default, pinned by `packages/sds/src/components/dialog/dimmer.test.mts`. A caller opts in with `closeOnDimmerClick` only for a choice a tap outside may decline. `Dialog.Alert` keeps closing on a tap outside.
- <a id="dialog-04"></a>**DIALOG-04** · Keep a dialog's buttons neutral by default. Use `tone="brand"` only when the message is about the product's core value, and `tone="critical"` when something the user made may be lost.
- <a id="dialog-05"></a>**DIALOG-05** · Use the dialog as given. Never restyle it or change its alignment through its content.
- <a id="dialog-06"></a>**DIALOG-06** · Omit the title when the description carries the message.

Dialog layering is ELEV-01. The left button's label is in [ux-writing.md](ux-writing.md).

### Sheet

- <a id="sheet-01"></a>**SHEET-01** · Use a `Sheet` for extra detail, options or an action list without leaving the screen.
- <a id="sheet-02"></a>**SHEET-02** · Keep a sheet under 90% of the screen height. Content that would pass it becomes a page.
- <a id="sheet-03"></a>**SHEET-03** · Let a sheet close by a downward drag, a tap outside and back. Not enforced yet.
- <a id="sheet-04"></a>**SHEET-04** · For critical input (a form) or a sheet with its own inner pages, put a close button at the top and turn off swipe-to-dismiss.
- <a id="sheet-05"></a>**SHEET-05** · Show a handle whenever the sheet has more than one detent, and use two or three detents.
- <a id="sheet-06"></a>**SHEET-06** · A sheet with a header has a title. Keep title and description short.
- <a id="sheet-07"></a>**SHEET-07** · Scroll only inside a sheet's content area, with a fade at the bottom showing there is more.
- <a id="sheet-08"></a>**SHEET-08** · Group an action menu sheet only from three items, in at most three groups, never scrolling. Put irreversible items (delete, report, leave) in the critical tone, and never mix icon and text-only items.

Sheet mechanics are in [bottom-sheet-system.md](../explanation/bottom-sheet-system.md).

### List rows and dividers

- <a id="list-01"></a>**LIST-01** · Present scannable rows with `ListRow` under a `ListHeader`, rather than a hand-built card.
- <a id="list-02"></a>**LIST-02** · Centre a row's parts for one-line rows. Align them to the top (`leftAlignment` and `rightAlignment` `"top"`) when the title wraps or the detail is long.
- <a id="list-03"></a>**LIST-03** · Never pad a row narrower than the screen gutter, and keep every row in a list on one alignment.
- <a id="list-04"></a>**LIST-04** · Put at most three interactive elements in a row.
- <a id="list-05"></a>**LIST-05** · Inside a rounded card, round a row's pressed surface to the card's radius minus the card's padding.
- <a id="list-06"></a>**LIST-06** · Highlight a row (`shine`, `blink`) only for a new item or an update.
- <a id="list-07"></a>**LIST-07** · Put the main information on the left and dates, times, prices or status right-aligned on the right.
- <a id="list-08"></a>**LIST-08** · End a list that can load or expand more with a footer row.
- <a id="div-01"></a>**DIV-01** · Divide repeated items with `stroke.neutralSubtle` and sections with `stroke.neutralMuted` (COLOR-17, COLOR-18). `Border`'s lines are item dividers, and its band (`variant="height16"`) keeps the section ground.
- <a id="div-02"></a>**DIV-02** · Use the weakest separation that works. An inset divider separates items within a group and a full-width one separates groups or the action area. Content that differs strongly takes a band (`Border variant="height16"`).
- <a id="div-03"></a>**DIV-03** · Add a divider only when needed, and never under the last section.

### Badge

- <a id="badge-01"></a>**BADGE-01** · A badge is a static label. For an action, use a chip or a button. Enforced by `Badge` taking no press handler.
- <a id="badge-02"></a>**BADGE-02** · Color a badge by status meaning: neutral, informative, positive, warning or critical. Its `color` and `backgroundColor` take role names, so a free color string is a type error.
- <a id="badge-03"></a>**BADGE-03** · Pick emphasis by context. Solid suits images and strong attention, and weak suits repeated structures and category tags. Never put a weak badge on a colored background.
- <a id="badge-04"></a>**BADGE-04** · Put at most one or two badges on an item.
- <a id="badge-05"></a>**BADGE-05** · Show a count or a dot only for an unread or unchecked key state, remove it once seen, never show 0, cap the count (`99+`), and never badge three or more tabs at once.

### Text input

- <a id="field-01"></a>**FIELD-01** · Use `TextField variant="box"` by default and `variant="line"` when the screen has a single input.
- <a id="field-02"></a>**FIELD-02** · Give every field a visible label, and never let the placeholder stand in for it. `TextField` keeps its label above the input by default (`labelOption="sustain"`), pinned by `textFieldRecipe.test.mts`. `labelOption="appear"` is the exception that needs a reason.
- <a id="field-03"></a>**FIELD-03** · Show help text under the field. On error, swap it for the error message (`hasError`).
- <a id="field-04"></a>**FIELD-04** · Show a clear button only when the field has a value, and a character count only when the length is limited.
- <a id="field-05"></a>**FIELD-05** · Never split a fixed-format value (a phone number) across inputs. Format one input as the user types.
- <a id="field-06"></a>**FIELD-06** · Validate simple rules (required, length) inline and business or server rules on submit.
- <a id="field-07"></a>**FIELD-07** · Mark required and optional fields one way per form: when most are required, mark only the optional ones. Otherwise mark the required ones.
- <a id="field-08"></a>**FIELD-08** · Put two inputs on a row only when labels and values are short, with room against mis-taps.
- <a id="field-09"></a>**FIELD-09** · Use `SearchField` for search, kept at the top without shifting the layout.

### Loading components

Which one to show is LOADP-01 to LOADP-03.

- <a id="load-01"></a>**LOAD-01** · Shape a `Skeleton` like the content it replaces with its `shape`: `text`, `card` (cards and thumbnails) or `avatar`. The shape sets the radius, pinned by `packages/sds/src/components/skeleton/skeletonShape.test.mts`. A block whose content has a radius of its own may pass `borderRadius` instead, never both.
- <a id="load-02"></a>**LOAD-02** · Never show a skeleton and a spinner in one loading state.
- <a id="load-03"></a>**LOAD-03** · Draw a spinner with `Loader`: `size="medium"` for a full page, `size="small"` inside an element. [`sds/no-rn-primitive`](../../packages/sds/SDS.md#lint-rules) rejects `ActivityIndicator`. The size is review.
- <a id="load-04"></a>**LOAD-04** · Color a spinner `tone="neutral"` (the default), `tone="brand"` only at an early key transition, `tone="staticWhite"` on a dark background.
- <a id="load-05"></a>**LOAD-05** · Delay a spinner (`Loader delay`) so a short load never flashes.
- <a id="load-06"></a>**LOAD-06** · On a first load with no content, show the spinner alone and centred. Over existing content, add a dim, small if what is behind stays usable.
- <a id="load-07"></a>**LOAD-07** · Use a progress bar for work with a clear start and end (an upload, a download).

### ResultSection

- <a id="result-01"></a>**RESULT-01** · Build every empty, success and failure state with `ResultSection`, `size="large"` for a state that fills the screen and `medium` inside a card or a section. Enforced by [`no-restricted-imports`](../../packages/sds/SDS.md#lint-rules) (`Result`, `ErrorPage`) and flagged by [`sds/no-handbuilt-part`](../../packages/sds/SDS.md#lint-rules) (a hand-built state or retry label).
- <a id="result-02"></a>**RESULT-02** · For empty, say what is missing and what to do next. For failure, how to resolve it (usually retry). For success, show the result, with a button only when a next step exists.
- <a id="result-03"></a>**RESULT-03** · Put the core next action in the bottom CTA and resolving or supporting actions in the section's own buttons. A state whose only way on is the product's core action (a sign-in gate) gives its primary `tone: 'brand'` instead.
- <a id="result-04"></a>**RESULT-04** · Offer retry on a failure screen beside the way out, which is back when the user can fix the input and close for a temporary layer. When there is no way back, the way out is a home button.
- <a id="result-05"></a>**RESULT-05** · Use an icon for an empty state, and no illustration for a generic message.

### Navigation

- <a id="nav-01"></a>**NAV-01** · Use back for one step back in a hierarchy, keeping input. Use close to end a modal, a sheet or a standalone flow.
- <a id="nav-02"></a>**NAV-02** · Go back through history in search and feeds, and up the hierarchy in fixed structures such as settings and from a deep-linked detail.
- <a id="nav-03"></a>**NAV-03** · Keep the header title to one line, with at most two icon buttons or one text button on the right. Past that, a more button opens a menu sheet.
- <a id="nav-04"></a>**NAV-04** · Keep the header pinned on scroll. A transparent header fills its background as content scrolls under it.
- <a id="nav-05"></a>**NAV-05** · Give the tab bar at most five tabs with short labels, one icon style (fill) with selection shown by color, and no font scaling. The tab icons are exported by `apps/mobile/scripts/export-tab-icons.mjs`, so the fill rule lives there.

### Accordion

- <a id="acc-01"></a>**ACC-01** · Use `AccordionList` to group related information or shorten a long page, with at least two items, all starting collapsed. The whole header is the target.
- <a id="acc-02"></a>**ACC-02** · Open one panel at a time for step processes and small areas. Allow several for FAQs and content-rich lists.
- <a id="acc-03"></a>**ACC-03** · Never scroll inside a panel. Let the page scroll.

### Floating buttons, steppers, images

- <a id="float-01"></a>**FLOAT-01** · Place a floating action `SdsSpacing.x5` from the screen edge or from any fixed bottom element, near the content it acts on, and label an icon-only one.
- <a id="qty-01"></a>**QTY-01** · Bound a number stepper with a minimum and a maximum, disable the button at its limit, match its size to the inputs beside it, and keep only its buttons pressable.
- <a id="img-01"></a>**IMG-01** · Show an image loading state only when loads are slow enough to notice, as a skeleton by default.
- <a id="img-02"></a>**IMG-02** · Round images at `SdsRadius.r2`, smaller ones at `SdsRadius.r1` or `SdsRadius.r1_5`, and a full-bleed image not at all.
- <a id="img-03"></a>**IMG-03** · Put at most two overlays on an image, each in its own corner and each with its own job. A badge shows status, an indicator shows a count or a length, and an icon shows the content type.
- <a id="img-04"></a>**IMG-04** · Use graphics as [ux-writing.md "Using graphics"](ux-writing.md#using-graphics) says.

## Patterns

### Product principles and dark patterns

- <a id="pat-01"></a>**PAT-01** · Hold every screen to the product principles.
  - Simplicity: the screen is understood without explanation.
  - Clear Action: the result of a tap is predictable.
  - No Deception: nothing shows up at a moment, in a form or in a place the user did not expect.
  - Value First: nothing interrupts the user's own goal.
- <a id="pat-02"></a>**PAT-02** · Never open a sheet that covers the screen when the user arrives, a notification-consent sheet included. Show the screen the user came for first.
- <a id="pat-03"></a>**PAT-03** · Never interrupt back or exit with a sheet or a prompt designed to keep the user.
- <a id="pat-04"></a>**PAT-04** · Always offer a way to decline and a way out of every screen.
- <a id="pat-05"></a>**PAT-05** · Never interrupt a flow with an unexpected full-screen interstitial.
- <a id="pat-06"></a>**PAT-06** · Make a CTA say what happens next, and put no exaggerated or repeated helper copy above it.
- <a id="pat-07"></a>**PAT-07** · Ask for a device permission before using it, and keep the rest of the app working if the user refuses.
- <a id="pat-08"></a>**PAT-08** · Make back work on every screen: the first screen's back exits, Android's system back goes back or exits, and back still works after entering by a link.
- <a id="pat-09"></a>**PAT-09** · Keep scroll, touch and transition responses under two seconds.

### Screen composition and the bottom CTA

- <a id="cta-01"></a>**CTA-01** · Build most screens from a header and `ListRow`s, stacking SDS components that carry their own padding without extra gaps.
- <a id="cta-02"></a>**CTA-02** · Pin a flow's completing action at the bottom (`FixedBottomCTA`), clear of the bottom safe area, so it stays reachable through long scrolls and typing.
- <a id="cta-03"></a>**CTA-03** · Carry a single CTA above the keyboard without changing its opacity or position. A two-button CTA stays put.

### Choosing a feedback surface

- <a id="choice-01"></a>**CHOICE-01** · Route a message by severity and persistence. A persistent warning never goes in a toast.

  | Message | Surface |
  | --- | --- |
  | Low-severity and transient | `Toast` |
  | A warning that must stay, or long guidance | `Callout` |
  | Page-wide status | A top banner |
  | A decision that must be made | `Dialog.Confirm`, or a `Sheet` for more options |
  | Extra information without leaving | `Sheet` |

- <a id="choice-02"></a>**CHOICE-02** · Ask a mandatory binary question in a centred dialog that only its buttons close. Offer two or more actions in a sheet that a tap outside also closes.
- <a id="choice-03"></a>**CHOICE-03** · Report an input problem next to the field it concerns, not in a toast or a dialog.

### Loading

- <a id="loadp-01"></a>**LOADP-01** · Pick the indicator by expected wait: under a second, none. A few seconds, a spinner or a skeleton. Longer, a skeleton or progress with a message. Past ten seconds, determinate progress with an estimate. Past a minute, also an offer to continue in the background or cancel.
- <a id="loadp-02"></a>**LOADP-02** · Pick it by situation.

  | Situation | Indicator |
  | --- | --- |
  | First entry | A skeleton or a spinner |
  | Loading more | A spinner |
  | Pull to refresh | The refresh spinner |
  | Save or submit | The button's loading state |
  | A small area | A small spinner beside it |

- <a id="loadp-03"></a>**LOADP-03** · Use a skeleton for repeated data views (lists, cards) and pages whose structure can be previewed, and a spinner for a load an action started.
- <a id="loadp-04"></a>**LOADP-04** · After loading, show nothing extra for a simple success and a result (`ResultSection` or a toast) where feedback is needed. On failure, say what went wrong and offer retry.

### Safe area

- <a id="safe-01"></a>**SAFE-01** · Keep text, buttons and anything that loses meaning when clipped inside the safe area, and measure their margins from the safe-area edge.
- <a id="safe-02"></a>**SAFE-02** · Run backgrounds, full-width dividers, hero images, maps and video to the screen edges while their text and buttons stay inside.
- <a id="safe-03"></a>**SAFE-03** · Let scroll areas run to the screen edge while fixed bars stay inside, and end the scroll with the last item plus base padding inside the safe area.
- <a id="safe-04"></a>**SAFE-04** · Read insets live. Never assume a side is 0, that top equals bottom, or a value measured on one device.
- <a id="safe-05"></a>**SAFE-05** · Align safe-area content against the same safe area as its neighbours.

A modal route mounts its own `SafeAreaProvider`, for the reason `apps/mobile/app/profile-setup.tsx` gives. The tab-bar case is explained in [the iOS 26 tab bar note](../explanation/ios-26-native-tabs-minimize.md).

### Forms

- <a id="form-01"></a>**FORM-01** · Before leaving a create or edit screen with unsaved input, confirm with a dialog. Skip it when nothing changed or input saves itself.
- <a id="form-02"></a>**FORM-02** · Keep create and edit forms the same, and split a form into steps when later input depends on earlier choices.
- <a id="form-03"></a>**FORM-03** · State a multi-select's maximum in its help text, offer a "none" option only where none is a valid answer, and add no option that changes the others (use a parent checkbox).
- <a id="form-04"></a>**FORM-04** · Preselect a sensible default where a value can never be empty or one choice is safest or most common.

## Accessibility

- <a id="a11y-01"></a>**A11Y-01** · Measure contrast with WCAG 2.x at the AA thresholds, one for body text and a lower one for large or bold text and icons. WCAG 2.x is the standard, as [ADR 0011 §2](../decisions/0011-adopt-seed-color-token-structure.md#2-contrast-is-designed-for-both-modes-and-measured-with-wcag-2x) records. Enforced for the role pairs by `packages/shared/src/tokens/__tests__/semanticColors.test.ts`, which holds the thresholds.
- <a id="a11y-02"></a>**A11Y-02** · Reach the floor for small secondary text by color, not by making it bold.
- <a id="a11y-03"></a>**A11Y-03** · Never let color alone tell the user something. Pair it with text or an icon.
- <a id="a11y-04"></a>**A11Y-04** · Make every touch target 44×44pt where possible and never smaller than 24×24pt, extending a small visual with `hitSlop`. Not enforced yet. SDS adds no slop itself.
- <a id="a11y-05"></a>**A11Y-05** · Order content so a screen reader reads it in sequence.
- <a id="a11y-06"></a>**A11Y-06** · Give every complex gesture (a pinch, a drag between detents, a swipe) a plain-tap alternative.
- <a id="a11y-07"></a>**A11Y-07** · Make every interaction reachable with VoiceOver and TalkBack, each pressable announcing its role and state. Enforced by SDS `Pressable` and the `Chip` parts, and by `sds/android-accessibility-role`, which rejects an iOS-only role that Android throws on.
- <a id="a11y-08"></a>**A11Y-08** · Give every non-text element that acts or informs a short label naming its function, and hide decorative ones from screen readers. Not enforced yet (BTN-12).
- <a id="a11y-09"></a>**A11Y-09** · Report an error at once, both visually (`hasError`) and to assistive technology (`accessibilityLiveRegion`, `AccessibilityInfo.announceForAccessibility`), next to the field, with a concrete fix.
- <a id="a11y-10"></a>**A11Y-10** · Follow the OS font size without breaking layouts: see [OS font size](#os-font-size).
- <a id="a11y-11"></a>**A11Y-11** · Honour Reduce Motion, make an animation of two seconds or more skippable, and never flash more than three times a second.
- <a id="a11y-12"></a>**A11Y-12** · Keep media autoplay off, start it muted when it must autoplay, and give longer audio pause, stop or volume control.
- <a id="a11y-13"></a>**A11Y-13** · Leave room for translated text in buttons and labels, which can grow far beyond the Korean, and let it wrap.
- <a id="a11y-14"></a>**A11Y-14** · Write a label without the element's type or state ("checkbox", "on"). The role and state are announced separately. Not enforced yet.
- <a id="a11y-15"></a>**A11Y-15** · Announce an important toast at once and an ordinary one politely.
- <a id="a11y-16"></a>**A11Y-16** · Give a button that shows only a loading mark a label naming the work, and report it busy. `Button` passes `disabled` but not `busy` today.
- <a id="a11y-17"></a>**A11Y-17** · Mark a screen or result title as a header and its illustration as decorative. Not enforced yet.

## Copy

Every rule about words, from register and voice to button labels, toast text and date formats, is in [ux-writing.md](ux-writing.md). This page states none of them.

## Open items

Choices made but not built yet, and one gap left open on purpose. Each rule above that depends on one links here.

### Screen gutter

`SdsSpacing.gutter` holds the horizontal inset between the screen edge and content (SPACE-02, LIST-03), and every screen-edge 20 reads it ([ADR 0017](../decisions/0017-add-a-screen-gutter-token.md)). Some full-width screens still inset by 16 or 24, such as the search field and the campus sheet column. They move onto the gutter in a migration batch with screenshots. Write `SdsSpacing.gutter` in new code.

### OS font size

Following the OS font size is left open on purpose, with its own decision to come. Text should follow it up to a cap, while text inside a fixed box such as a badge or the tab bar keeps its size (TYPE-11, A11Y-10). `Txt` turns font scaling off everywhere today. Turning it on would roll out screen by screen with screenshots.

### Missing components

Rules that apply with nothing in SDS to follow them yet:

| Missing | Rules waiting on it |
| --- | --- |
| A page banner | CALLOUT-07, CHOICE-01 |
| A menu sheet, a select, a select box, an input button | SHEET-08, SEL-06, SEL-07, FORM-03 |
| A scroll fade for sheets, a tooltip, a tag group, an image frame | SHEET-07, IMG-01 to IMG-03 |
| A notification badge (only `Tab redBean` exists) | BADGE-05, TAB-06 |
| A stacked radio list, a list footer, a progress bar, a number stepper. SDS deleted its TDS ones while nothing used them | SEL-03 to SEL-05, LIST-08, LOAD-07, QTY-01 |
| A toast host with a queue | TOAST-03 |
| The functional, exit and expressive curves in `SdsCurves` | MOTION-02 |
| Semantic spacings beyond the gutter, semantic text styles, a monospaced or tabular-figure text style | SPACE-04 to SPACE-08, TYPE-04 to TYPE-07 |
| A display step above `t13`. The few display figures are React Native's `Text` behind a reasoned disable until the umbrella's type scale adds one | TYPE-09 |
| Outline buttons, a public ghost button, a pill button size | Rules for them are not written until SDS has them |

## Exceptions

A rule that does not apply takes one of the forms the [ratchet how-to](../how-to/work-under-the-lint-ratchet.md#a-rule-does-not-apply-here) lists. Disable one line with a reason, add an entry with a reason to `scripts/eslint/sds-exceptions.cjs`, or narrow the rule's `files` scope in `eslint.config.js`. [ADR 0016](../decisions/0016-ratchet-lint-debt-with-bulk-suppressions.md) §5 explains why there are no others.

- A role that exists is never an exception. A map tint, a web view background and the status bar take a role's value too.
- When no role fits, add the role ([ADR 0015](../decisions/0015-name-component-apis-in-seed-vocabulary.md) §3). Do not disable the rule.
- A review rule has no disable. Breaking one is a decision for the review, recorded in the commit message.
- Never move or rename a file so that a rule stops matching it.

## The ratchet loop

The lint rules run at error over a recorded backlog, `eslint-suppressions.json`, which may only shrink. The daily loop is in the [ratchet how-to](../how-to/work-under-the-lint-ratchet.md):

1. Fix the code. A new file starts at zero.
2. Run `yarn lint:prune` if you fixed recorded violations.
3. Commit the code and the smaller record together.

Never run `eslint --suppress-all` or `--suppress-rule` to make lint pass. `yarn sds:report` prints the backlog per rule.

## Review checklist

Before you approve a screen, check:

- [ ] Every color is a role, and each role sits on its kind of property (COLOR-01, COLOR-03).
- [ ] Text is `Txt` or a `SdsTypo` style, with one title level and one body level (TYPE-01, TYPE-03).
- [ ] Spacing and radius come from the scales, and the screen-edge inset is the gutter (SPACE-01, SPACE-02, RADIUS-01).
- [ ] At most one high-emphasis solid button, on the main action (BTN-01).
- [ ] Chips, banners, empty and error states are SDS parts (CHIP-01, CALLOUT-07, RESULT-01).
- [ ] Each message sits on the surface its severity calls for (CHOICE-01).
- [ ] A confirm dialog closes only by its buttons (DIALOG-03).
- [ ] Cards separate by surface or stroke. Shadows only on floating elements (ELEV-04).
- [ ] Item dividers are subtle and no divider sits under the last section (DIV-01, DIV-03).
- [ ] Loading shows the indicator its wait calls for, never a skeleton and a spinner together (LOADP-01, LOAD-02).
- [ ] Everything pressable gives SDS feedback and has a label when it has no text (PRESS-01, A11Y-08).
- [ ] Information never travels by color alone, and targets meet the size floor (A11Y-03, A11Y-04).
- [ ] The screen holds to the product principles and avoids the dark patterns (PAT-01 to PAT-06).
- [ ] The copy follows [ux-writing.md](ux-writing.md).
- [ ] `yarn lint` passes with the record unchanged or smaller.

## Related

- [`packages/sds/SDS.md`](../../packages/sds/SDS.md): how each component and token works, and the lint rules table
- [ux-writing.md](ux-writing.md): the words
- [ADR 0011](../decisions/0011-adopt-seed-color-token-structure.md) to [ADR 0019](../decisions/0019-clean-up-the-sds-api-without-aliases.md): the decisions behind colors, type, spacing, press feedback, component APIs, the ratchet, the gutter, card surfaces and the API cleanup
- [work-under-the-lint-ratchet.md](../how-to/work-under-the-lint-ratchet.md): the daily loop and the exception forms
