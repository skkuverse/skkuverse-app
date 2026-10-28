/** WHY: resultSectionRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { RecipeTheme } from '../../core/recipe';
import type { ButtonTone, ButtonVariant } from '../button/buttonRecipe';

export type ResultSectionSize = 'large' | 'medium';

export type ResultSectionActionTone = 'neutral' | 'brand';

/** WHY: `brand` is SDS's addition, only for a state whose only way on is the product's core action, such as a sign-in gate (BTN-01: the screen's one fill). */
export const RESULT_SECTION_PRIMARY = {
  neutral: { tone: 'neutral', variant: 'weak' },
  brand: { tone: 'brand', variant: 'solid' },
} as const satisfies Record<ResultSectionActionTone, { tone: ButtonTone; variant: ButtonVariant }>;

/** WHY: SEED's text styles carry over by pixel size, not by name (ADR 0012): its t8 (22px) is SDS's t10, its t5 (16px) SDS's t6. */
export const RESULT_SECTION_TEXT = {
  title: {
    large: { typography: 't10', fontWeight: 'bold' },
    medium: { typography: 't6', fontWeight: 'bold' },
  },
  description: {
    large: { typography: 't6', fontWeight: 'regular' },
    medium: { typography: 't4', fontWeight: 'regular' },
  },
  secondaryAction: { typography: 't4', fontWeight: 'bold' },
} as const;

export function resultSectionRecipe({ color, spacing, radius }: RecipeTheme) {
  return {
    base: {
      root: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.x12,
        paddingVertical: spacing.x4,
      },
      asset: { alignItems: 'center', paddingBottom: spacing.x4 },
      text: { alignItems: 'center' },
      title: { textAlign: 'center', color: color.fg.neutral },
      description: { textAlign: 'center', color: color.fg.neutralMuted },
      actions: { alignItems: 'center', gap: spacing.x5 },
      // WHY: the padding bleeds out (SEED's `bleed="asPadding"`), so the label lines up with the text above while the touch box stays full size.
      secondaryAction: {
        minHeight: spacing.x9,
        paddingHorizontal: spacing.x3_5,
        paddingVertical: spacing.x2,
        marginHorizontal: -spacing.x3_5,
        marginVertical: -spacing.x2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.r2,
      },
      secondaryActionLabel: { color: color.fg.neutral },
    },
    variants: {
      size: {
        large: { text: { gap: spacing.x3, paddingBottom: spacing.x7 } },
        medium: { text: { gap: spacing.x2, paddingBottom: spacing.x6 } },
      },
      secondaryDisabled: {
        true: { secondaryActionLabel: { color: color.fg.disabled } },
        false: {},
      },
    },
    defaultVariants: { size: 'large', secondaryDisabled: false },
  } as const;
}
