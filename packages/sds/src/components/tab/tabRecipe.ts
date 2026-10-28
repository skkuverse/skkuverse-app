/** WHY: tabRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';

export type TabSize = 'large' | 'small';

export const TAB_LABEL_TEXT = {
  large: { typography: 't7' },
  small: { typography: 't5' },
  selected: { fontWeight: 'semiBold' },
  rest: { fontWeight: 'regular' },
} as const;

export function tabRecipe({ color, spacing, radius }: RecipeTheme) {
  return {
    base: {
      bar: { position: 'relative' },
      row: { flexDirection: 'row' },
      item: { paddingVertical: spacing.x3, alignItems: 'center', justifyContent: 'center' },
      itemInner: { flexDirection: 'row', alignItems: 'center' },
      label: { color: color.fg.neutralSubtle },
      redBean: {
        width: 6,
        height: 6,
        borderRadius: radius.full,
        backgroundColor: color.bg.criticalSolid,
        marginLeft: spacing.x1,
        marginTop: -spacing.x2,
      },
      line: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: color.stroke.neutralMuted,
      },
      indicator: {
        position: 'absolute',
        bottom: 0,
        height: 2,
        borderRadius: radius.full,
        // eslint-disable-next-line sds/role-placement -- SEED's tablist draws the indicator in fg.neutral, the selected label's color; it is a mark under the text, not a surface
        backgroundColor: color.fg.neutral,
      },
    },
    variants: {
      fluid: {
        true: { item: { paddingHorizontal: spacing.x4 } },
        false: { item: { flex: 1 } },
      },
      selected: {
        true: { label: { color: color.fg.neutral } },
        false: {},
      },
      // WHY: a tab with nothing behind it is struck through in the resting color; a lighter grey read as one more resting tab.
      disabled: {
        true: { label: { textDecorationLine: 'line-through' } },
        false: {},
      },
    },
    defaultVariants: { fluid: false, selected: false, disabled: false },
  } as const;
}
