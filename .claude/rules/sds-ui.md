---
paths:
  - "apps/mobile/**/*.{ts,tsx}"
  - "packages/sds/src/**/*.{ts,tsx}"
---

# SDS UI rules

UI code here is held to the Skku Design System. `yarn lint` is the gate, and its `sds/*` messages name what to use instead.

- Colors are roles: `useSemanticColors()` in a component, `createThemedStyles()` in a StyleSheet. Never a hex, a CSS color name, `SdsColors`, a palette step or a cast to a role type, and no color read at module scope. `fg` goes on text and icons, `bg` on surfaces, `stroke` on lines. A missing role is added (ADR 0015), not worked around.
- Text is `<Txt typography fontWeight>` or a `SdsTypo` style, never React Native's `Text` or a literal `fontSize`, `fontWeight` or `fontFamily`. Emoji go through `<Tossface>`.
- Padding, margin and gap come from `SdsSpacing`, corners from `SdsRadius` (`SdsRadius.full` for a pill).
- Anything pressable is SDS `Pressable` with a `bg` role, or `usePressFeedback`. Never React Native's `Pressable` or `Touchable*`, never opacity as press feedback.
- Use the SDS part before building one: `Button`, `Chip`, `Callout`, `ResultSection`, `ListRow`, `Loader`, `Switch`, `Dialog`, `Toast`, `Sheet`. Icons are `phosphor-react-native`. Shadows come from `SdsShadows`, on floating elements only.
- When to use which part: `docs/reference/design-usage.md`, where every rule ID a lint message cites has a section. The words: `docs/reference/ux-writing.md`.

The ratchet: `eslint-suppressions.json` records the old violations and may only shrink.

- A file over its record lists every violation of that rule. Fix the one your diff added and leave the rest to their migration batch.
- After fixing recorded violations, run `yarn lint:prune` and commit the smaller record with the fix.
- Never run `eslint --suppress-all` or `--suppress-rule`, never raise a count in the record, never move or rename a file so a rule stops matching it.
- An exception is one line, `// eslint-disable-next-line sds/<rule> -- <reason>`, and nothing broader.

Procedures for building a screen or adding a component: the `sds` skill.
