/** WHY: checkboxRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { FgColorName } from '@skkuverse/shared';
import type { RecipeTheme } from '../../core/recipe';

export type CheckboxShape = 'line' | 'circle';

export const CHECKBOX_CHECK = {
  enabled: 'onInformativeSolid',
  disabled: 'disabled',
} as const satisfies Record<'enabled' | 'disabled', FgColorName>;

export function checkboxLineRadius(size: number): number {
  return size * 0.25;
}

export function checkboxRecipe({ color, spacing, radius }: RecipeTheme) {
  return {
    base: {
      root: { flexDirection: 'row', alignItems: 'center' },
      box: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: color.stroke.control,
        backgroundColor: color.bg.transparent,
      },
      fill: { backgroundColor: color.bg.informativeSolid },
      label: { marginLeft: spacing.x3, flex: 1 },
    },
    variants: {
      shape: {
        line: {},
        circle: { box: { borderRadius: radius.full }, fill: { borderRadius: radius.full } },
      },
      disabled: {
        true: {
          box: { borderColor: color.stroke.neutralWeak, backgroundColor: color.bg.disabled },
          fill: { backgroundColor: color.bg.disabled },
        },
        false: {},
      },
    },
    defaultVariants: { shape: 'line', disabled: false },
  } as const;
}
