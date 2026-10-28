/**
 * Type tests for recipes and press feedback, run by `yarn typecheck`
 * (nothing imports this file, so it never reaches the bundle). Each
 * `@ts-expect-error` fails the typecheck if the line it guards compiles.
 */
import type { RecipeTheme } from './recipe';
import { buttonVariantMap } from '../components/button/Button';
import { createRecipe } from './createRecipe';
import { usePressFeedback } from './usePressFeedback';

const chip = ({ color, radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.full }, label: {} },
    variants: {
      tone: { neutral: {}, brand: { root: { backgroundColor: color.bg.brandSolid } } },
      selected: { true: { label: { fontWeight: '700' } }, false: {} },
    },
    compoundVariants: [{ tone: 'brand', selected: true, style: { label: { color: color.fg.brand } } }],
    defaultVariants: { tone: 'neutral', selected: false },
  }) as const;

const useChip = createRecipe(chip);

export function RecipeTypeTests() {
  // Every variant is optional, and a boolean variant takes a boolean.
  const styles = useChip({ tone: 'brand', selected: true });
  useChip();
  // The slots are the keys of `base`.
  void styles.root;
  void styles.label;
  // @ts-expect-error — no such slot
  void styles.icon;
  // @ts-expect-error — no such value
  useChip({ tone: 'critical' });
  // @ts-expect-error — no such variant
  useChip({ size: 'small' });
  // @ts-expect-error — a boolean variant takes a boolean
  useChip({ selected: 'true' });

  // The variant map is typed per variant.
  const tones: readonly ('neutral' | 'brand')[] = useChip.variantMap.tone;
  const selected: readonly boolean[] = useChip.variantMap.selected;
  void tones;
  void selected;

  // The Button's recipe infers its own axes.
  const buttonTones: readonly ('brand' | 'critical' | 'neutral')[] = buttonVariantMap.tone;
  const buttonDisabled: readonly boolean[] = buttonVariantMap.disabled;
  void buttonTones;
  void buttonDisabled;
  // @ts-expect-error — no such axis
  void buttonVariantMap.type;

  // A surface needs a `-pressed` pair.
  usePressFeedback({ bg: 'brandSolid' });
  usePressFeedback({ bg: 'transparent' });
  // @ts-expect-error — `disabled` has no pressed pair
  usePressFeedback({ bg: 'disabled' });
  // @ts-expect-error — a pressed token is not a resting surface
  usePressFeedback({ bg: 'brandSolidPressed' });
  return null;
}

// A definition error is reported at the `createRecipe` call, so each case
// is a recipe of its own, as it would be in its own module.

const badDefault = ({ radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.r2 } },
    variants: { tone: { neutral: {}, brand: {} } },
    defaultVariants: { tone: 'critical' },
  }) as const;
// @ts-expect-error — the default must be one of the values
createRecipe(badDefault);

const badCompoundValue = ({ radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.r2 } },
    variants: { tone: { neutral: {}, brand: {} } },
    compoundVariants: [{ tone: 'critical', style: { root: {} } }],
    defaultVariants: { tone: 'neutral' },
  }) as const;
// @ts-expect-error — a compound's value must exist
createRecipe(badCompoundValue);

const badVariantSlot = ({ radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.r2 } },
    variants: { tone: { neutral: { root: {}, rooot: {} } } },
    defaultVariants: { tone: 'neutral' },
  }) as const;
// @ts-expect-error — a variant styles only the slots `base` has
createRecipe(badVariantSlot);

const badCompoundSlot = ({ radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.r2 }, label: {} },
    variants: { tone: { neutral: {}, brand: {} } },
    compoundVariants: [{ tone: 'brand', style: { root: {}, labl: {} } }],
    defaultVariants: { tone: 'neutral' },
  }) as const;
// @ts-expect-error — so does a compound
createRecipe(badCompoundSlot);

const reservedName = ({ radius }: RecipeTheme) =>
  ({
    base: { root: { borderRadius: radius.r2 } },
    variants: { style: { a: {} } },
    defaultVariants: { style: 'a' },
  }) as const;
// @ts-expect-error — `style` is reserved for a compound's styles
createRecipe(reservedName);
