/** WHY: badgeRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';

export type BadgeSize = 'large' | 'medium' | 'small' | 'xsmall';

export const BADGE_TEXT = {
  xsmall: { typography: 't3', fontWeight: 'semiBold' },
  small: { typography: 't3', fontWeight: 'bold' },
  medium: { typography: 't5', fontWeight: 'bold' },
  large: { typography: 't7', fontWeight: 'bold' },
} as const satisfies Record<BadgeSize, { typography: string; fontWeight: string }>;

export function badgeRecipe({ color, spacing, radius }: RecipeTheme) {
  return {
    base: {
      root: {
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.bg.neutralWeak,
      },
      label: { color: color.fg.neutralSubtle },
    },
    variants: {
      size: {
        // eslint-disable-next-line sds/no-spacing-literal -- the xsmall badge's height as drawn (1 + t3 + 1), pinned per size by badgeRecipe.test.mts
        xsmall: { root: { paddingHorizontal: spacing.x1, paddingVertical: 1, borderRadius: radius.r1 } },
        small: { root: { paddingHorizontal: spacing.x1_5, paddingVertical: spacing.x0_5, borderRadius: radius.r1_5 } },
        // eslint-disable-next-line sds/no-spacing-literal -- the medium badge's height as drawn (3 + t5 + 3), pinned per size by badgeRecipe.test.mts
        medium: { root: { paddingHorizontal: spacing.x2, paddingVertical: 3, borderRadius: radius.r2 } },
        large: { root: { paddingHorizontal: spacing.x2_5, paddingVertical: spacing.x1, borderRadius: radius.r2_5 } },
      },
    },
    defaultVariants: { size: 'small' },
  } as const;
}
