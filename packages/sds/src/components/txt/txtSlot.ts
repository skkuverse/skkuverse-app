/**
 * WHY: `Txt` refuses the size, line height, spacing, family and weight in `style`, and a recipe types every slot as any style, so this leaves them out.
 * Memoised per slot object, so a cached recipe resolution keeps a stable style identity; imports types only, like a recipe.
 */
import type { RecipeStyle } from '../../core/recipe';
import type { TxtOwnedStyleKey, TxtStyle } from './Txt';

const OWNED: readonly TxtOwnedStyleKey[] = ['fontSize', 'lineHeight', 'letterSpacing', 'fontFamily', 'fontWeight'];

const withoutTypeKeys = new WeakMap<RecipeStyle, TxtStyle>();

export function txtSlot(slot: RecipeStyle): TxtStyle;
export function txtSlot(slot: RecipeStyle | undefined | false): TxtStyle | undefined;
export function txtSlot(slot: RecipeStyle | undefined | false): TxtStyle | undefined {
  if (!slot) return undefined;
  let style = withoutTypeKeys.get(slot);
  if (style === undefined) {
    const copy: Record<string, unknown> = { ...slot };
    for (const key of OWNED) delete copy[key];
    style = copy as TxtStyle;
    withoutTypeKeys.set(slot, style);
  }
  return style;
}
