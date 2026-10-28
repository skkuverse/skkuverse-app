/** WHY: listRowRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { FgColorName } from '@skkuverse/shared';
import type { RecipeTheme } from '../../core/recipe';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

export type ListRowVerticalPadding = 'xsmall' | 'small' | 'medium' | 'large';
export type ListRowTextsLayout =
  | '1RowTypeA'
  | '1RowTypeB'
  | '1RowTypeC'
  | '2RowTypeA'
  | '2RowTypeB'
  | '2RowTypeC'
  | '2RowTypeD'
  | '2RowTypeE'
  | '2RowTypeF'
  | '3RowTypeA'
  | '3RowTypeB'
  | '3RowTypeC';

export function listRowVerticalPadding(
  value?: ListRowVerticalPadding | 8 | 16 | 24 | 32,
): ListRowVerticalPadding {
  switch (value) {
    case 'xsmall':
    case 8:
      return 'xsmall';
    case 'small':
    case 16:
      return 'small';
    case 'large':
    case 32:
      return 'large';
    default:
      return 'medium';
  }
}

export interface ListRowTextStyle {
  readonly typography: TypographyKeys;
  readonly fontWeight: FontWeightKeys;
  readonly color: FgColorName;
}

const primary = (fontWeight: FontWeightKeys): ListRowTextStyle => ({ typography: 't7', fontWeight, color: 'neutral' });
const secondary: ListRowTextStyle = { typography: 't5', fontWeight: 'regular', color: 'neutralSubtle' };
const caption: ListRowTextStyle = { typography: 't3', fontWeight: 'regular', color: 'neutralSubtle' };

export const LIST_ROW_TEXTS: Readonly<
  Record<
    ListRowTextsLayout,
    { top: ListRowTextStyle; middle?: ListRowTextStyle; bottom?: ListRowTextStyle }
  >
> = {
  '1RowTypeA': { top: primary('regular') },
  '1RowTypeB': { top: primary('bold') },
  '1RowTypeC': { top: { typography: 't5', fontWeight: 'regular', color: 'neutral' } },
  '2RowTypeA': { top: primary('regular'), bottom: secondary },
  '2RowTypeB': { top: primary('bold'), bottom: secondary },
  '2RowTypeC': { top: secondary, bottom: primary('regular') },
  '2RowTypeD': { top: secondary, bottom: primary('bold') },
  '2RowTypeE': { top: primary('regular'), bottom: caption },
  '2RowTypeF': { top: primary('bold'), bottom: caption },
  '3RowTypeA': { top: secondary, middle: primary('regular'), bottom: secondary },
  '3RowTypeB': { top: secondary, middle: primary('bold'), bottom: secondary },
  '3RowTypeC': { top: primary('bold'), middle: secondary, bottom: secondary },
};

export const LIST_ROW_LEFT_TEXT = { ...secondary, width: 80 } as const;

export const LIST_ROW_ARROW = { size: 18, color: 'placeholder' } as const satisfies {
  size: number;
  color: FgColorName;
};

export function listRowRecipe({ spacing }: RecipeTheme) {
  return {
    base: {
      root: { overflow: 'hidden' },
      container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.x6 },
      left: { marginRight: spacing.x4 },
      contents: { flex: 1 },
      right: { marginLeft: spacing.x4, flexDirection: 'row', alignItems: 'center' },
      arrow: { marginLeft: spacing.x1 },
      line: { marginTop: spacing.x0_5 },
    },
    variants: {
      verticalPadding: {
        xsmall: { container: { paddingVertical: spacing.x2 } },
        small: { container: { paddingVertical: spacing.x4 } },
        medium: { container: { paddingVertical: spacing.x6 } },
        large: { container: { paddingVertical: spacing.x8 } },
      },
      horizontalPadding: {
        none: { container: { paddingHorizontal: 0 } },
        default: {},
      },
      leftAlignment: {
        top: { left: { alignSelf: 'flex-start' } },
        center: { left: { alignSelf: 'center' } },
      },
      rightAlignment: {
        top: { right: { alignSelf: 'flex-start' } },
        center: { right: { alignSelf: 'center' } },
      },
      faded: {
        true: { container: { opacity: 0.5 } },
        false: {},
      },
    },
    defaultVariants: {
      verticalPadding: 'medium',
      horizontalPadding: 'default',
      leftAlignment: 'center',
      rightAlignment: 'center',
      faded: false,
    },
  } as const;
}
