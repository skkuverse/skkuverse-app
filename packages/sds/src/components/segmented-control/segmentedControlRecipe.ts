/** WHY: segmentedControlRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';

export const SEGMENTED_LABEL_WEIGHT = { selected: 'semiBold', rest: 'regular' } as const;

export function segmentedTrackInset({ spacing }: Pick<RecipeTheme, 'spacing'>): number {
  return spacing.x0_5;
}

export function segmentedControlRecipe({ color, spacing, radius }: RecipeTheme) {
  const inset = segmentedTrackInset({ spacing });
  return {
    base: {
      track: {
        flexDirection: 'row',
        borderRadius: radius.r2_5,
        padding: inset,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: color.bg.neutralWeak,
      },
      indicator: {
        position: 'absolute',
        left: inset,
        backgroundColor: color.bg.layerDefault,
        // WHY: the lift is `SdsShadows.segmentedIndicator`, which the component adds; a recipe imports types only.
      },
      item: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.x2,
        zIndex: 1,
      },
      label: { color: color.fg.neutralSubtle },
    },
    variants: {
      selected: {
        true: { label: { color: color.fg.neutral } },
        false: {},
      },
    },
    defaultVariants: { selected: false },
  } as const;
}
