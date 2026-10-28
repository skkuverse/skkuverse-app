# Build or change a screen

For a screen or an app component under `apps/mobile`. A new file starts with no lint record, so
it must be clean from its first commit.

## 1. Pick the parts

1. Read `docs/reference/design-usage.md` "To draw X, use Y" and take the SDS part for each piece.
   A part named under "Missing components" there does not exist yet. Ask before building one.
2. Read the part's props in its component under `packages/sds/src/components/`, and what
   `packages/sds/SDS.md` says it does. What SDS exports is
   `packages/sds/src/components/index.ts`.
3. Read the rules for each part you use in the guide's "Components" and "Patterns" sections, and
   pick the feedback surface by its "Choosing a feedback surface" rules.

## 2. Write it

- Colors through `useSemanticColors()` or `createThemedStyles()`; text through `Txt`; spacing
  and radius through `SdsSpacing` and `SdsRadius`; presses through SDS `Pressable` with `bg`.
- Strings through the i18n bundle (`useT()`), written to `docs/reference/ux-writing.md`.
- A role that does not exist is added in `packages/shared/src/tokens/semanticColors.ts`
  (ADR 0015), never replaced by a literal, a cast or a disable.

## 3. Check

```bash
yarn typecheck
node_modules/.bin/eslint --no-cache --max-warnings 0 <files>
yarn test:gate <files>
yarn lint
```

`yarn lint` also runs the disable guard, the record guard and markdownlint. If it lists many
violations of one rule in a file you touched, fix the one your diff added; see
`docs/how-to/work-under-the-lint-ratchet.md`.

## 4. Look at it

Run the screen on the iOS simulator in light mode and compare with a screenshot from before the
change. Then walk the guide's "Review checklist" for the screen.
