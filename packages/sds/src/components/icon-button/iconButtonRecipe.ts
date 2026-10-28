/** WHY: iconButtonRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { PressableBgToken } from '../../core/pressFeedback';
import type { RecipeTheme } from '../../core/recipe';

export type IconButtonVariant = 'weak' | 'ghost' | 'outline';

export const ICON_BUTTON_SURFACE = {
  weak: 'neutralWeak',
  ghost: 'transparent',
  outline: 'transparent',
} as const satisfies Record<IconButtonVariant, PressableBgToken>;

export function iconButtonSize(iconSize: number): number {
  return iconSize * 1.5;
}

export function iconButtonRecipe({ color, radius }: RecipeTheme) {
  return {
    base: {
      root: {},
      container: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
    },
    variants: {
      variant: {
        weak: { container: { backgroundColor: color.bg[ICON_BUTTON_SURFACE.weak] } },
        ghost: { container: { backgroundColor: color.bg[ICON_BUTTON_SURFACE.ghost] } },
        outline: {
          container: {
            backgroundColor: color.bg[ICON_BUTTON_SURFACE.outline],
            borderWidth: 1,
            borderColor: color.stroke.neutralMuted,
          },
        },
      },
      disabled: {
        true: { container: { opacity: 0.5 } },
        false: {},
      },
    },
    defaultVariants: { variant: 'ghost', disabled: false },
  } as const;
}
