# Add an SDS component, part or variant

For new work in `packages/sds/src`. The vocabulary is ADR 0015, the press is ADR 0014, and the
mechanics are `packages/sds/SDS.md` ("Component API vocabulary", "Recipes", "Pressable").

## 1. Check it is new

1. Search `packages/sds/src/components/index.ts` and `docs/reference/design-usage.md`
   "To draw X, use Y". A new look for an existing part is a variant of it.
2. Name its axes in ADR 0015's words: `tone` for meaning, `variant` for treatment, `size` as a
   word step. A part that behaves differently is its own part (`Chip.Toggle`, `Chip.RadioItem`).
   A color prop takes a role name, never a color string.

## 2. Write it

Under `packages/sds/src/components/<name>/`:

| File | Holds |
| --- | --- |
| `<Name>.tsx` | The component, reading `use<Name>Recipe` and pressing through `Pressable` with `bg` |
| `<name>Recipe.ts` | The recipe, importing types only (`sds/recipe-type-imports`) |
| `<name>Recipe.test.mts` | The recipe's `node --test`, as `components/button/buttonRecipe.test.mts` does it |
| `index.ts` | The exports, then add the folder to `components/index.ts` |

Every color is a role from the recipe's `RecipeTheme`, every spacing and radius a token. A role
the component needs and the tokens lack goes into `packages/shared/src/tokens/semanticColors.ts`
first, with its light and dark values and its contrast pair in `semanticColors.test.ts`.

## 3. Show it

Add the component to the state catalog, `apps/mobile/src/dev/sds-states/`, the only
catalog: a section laid out from the recipe's `variantMap`, or its states side by side when it has
no recipe. `componentContract.test.mts` fails until every exported component and every variant
map is there.
Open the catalog from the app's settings screen on the iOS simulator and look at every state.

## 4. Pin what types refuse

A prop the component refuses (a free color, a `style` key it owns) gets a case in
`packages/sds/src/components/seedComponents.typetest.tsx`.

## 5. Document it

- The API is its props' types. A reason the code cannot carry goes in a tagged comment at it
  (ADR 0026), and a behavior the product decided goes in `packages/sds/SDS.md`
  ("Decided behaviors").
- When to use it in `docs/reference/design-usage.md`: a "To draw X, use Y" row, and a rule under
  a new ID if it brings one. A lint message that cites an ID needs its section there, or
  `scripts/design-usage.test.mjs` fails.

## 6. Check

```bash
yarn workspace @skkuverse/sds test
yarn typecheck
yarn lint
```
