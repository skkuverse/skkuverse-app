/**
 * WHY: `Pressable` refuses a `backgroundColor` in `style` (its surface is `bg`), and a recipe types every slot as any style,
 * so this leaves the surface out. Memoised per slot object, so a cached recipe resolution keeps a stable style identity.
 */
import type { RecipeStyle } from '../../core/recipe';
import type { PressableStyle } from './Pressable';

const withoutSurface = new WeakMap<RecipeStyle, PressableStyle>();

export function pressableSlot(slot: RecipeStyle): PressableStyle {
  let style = withoutSurface.get(slot);
  if (style === undefined) {
    const copy: Record<string, unknown> = { ...slot };
    delete copy.backgroundColor;
    style = copy as PressableStyle;
    withoutSurface.set(slot, style);
  }
  return style;
}
