/** WHY: borderRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';

export type BorderVariant = 'full' | 'padding24' | 'height16';

export const BORDER_SPACER_HEIGHT = 16;

/** WHY: the hairline's height is the platform's `StyleSheet.hairlineWidth`, so Border.tsx adds it; a recipe imports types only. */
export function borderRecipe({ color, spacing }: RecipeTheme) {
  return {
    base: { root: {} },
    variants: {
      variant: {
        full: { root: { backgroundColor: color.stroke.neutralSubtle } },
        padding24: { root: { backgroundColor: color.stroke.neutralSubtle, marginHorizontal: spacing.x6 } },
        height16: { root: { height: BORDER_SPACER_HEIGHT, backgroundColor: color.bg.neutralMuted } },
      },
    },
    defaultVariants: { variant: 'full' },
  } as const;
}
