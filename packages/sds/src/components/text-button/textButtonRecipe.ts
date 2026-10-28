/** WHY: textButtonRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';

export type TextButtonVariant = 'arrow' | 'underline' | 'clear';

export const TEXT_BUTTON_ARROW = ' ›';

export function textButtonRecipe({ color }: RecipeTheme) {
  return {
    base: {
      root: { alignSelf: 'flex-start' },
      label: { color: color.fg.neutral },
    },
    variants: {
      variant: {
        arrow: {},
        underline: { label: { textDecorationLine: 'underline' } },
        clear: {},
      },
      disabled: {
        true: { label: { color: color.fg.disabled } },
        false: {},
      },
    },
    defaultVariants: { variant: 'clear', disabled: false },
  } as const;
}
