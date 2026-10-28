/** WHY: calloutRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { FgColorName } from '@skkuverse/shared';
import type { PressableBgToken } from '../../core/pressFeedback';
import type { RecipeTheme } from '../../core/recipe';

export type CalloutTone = 'neutral' | 'informative' | 'positive' | 'warning' | 'critical' | 'brand' | 'ai';

interface CalloutRoles {
  readonly surface: PressableBgToken;
  readonly content: FgColorName;
}

export const CALLOUT_ROLES = {
  neutral: { surface: 'neutralWeak', content: 'neutral' },
  informative: { surface: 'informativeWeak', content: 'informativeContrast' },
  positive: { surface: 'positiveWeak', content: 'positiveContrast' },
  warning: { surface: 'warningWeak', content: 'warningContrast' },
  critical: { surface: 'criticalWeak', content: 'criticalContrast' },
  brand: { surface: 'brandWeak', content: 'brandContrast' },
  ai: { surface: 'aiWeak', content: 'ai' },
} as const satisfies Record<CalloutTone, CalloutRoles>;

export const CALLOUT_TEXT = {
  title: { typography: 't4', fontWeight: 'bold' },
  description: { typography: 't4', fontWeight: 'regular' },
  link: { typography: 't4', fontWeight: 'regular' },
} as const;

export function calloutRecipe({ color, spacing, radius }: RecipeTheme) {
  // WHY: the close button's touch box bleeds into the padding by its excess over the icon, so the icon lines up with the edge like the prefix icon.
  const closeBleed = -(spacing.x10 - spacing.x4) / 2;
  const icon = {
    width: spacing.x4,
    height: spacing.x4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const toneStyles = (tone: CalloutTone) => {
    const { surface, content } = CALLOUT_ROLES[tone];
    const text = { color: color.fg[content] };
    return {
      root: { backgroundColor: color.bg[surface] },
      content: text,
      title: text,
      description: text,
      link: text,
    };
  };

  return {
    base: {
      root: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 50,
        paddingHorizontal: spacing.x3_5,
        paddingVertical: spacing.x3_5,
        gap: spacing.x3,
        borderRadius: radius.r2_5,
      },
      content: { flex: 1 },
      title: {},
      description: {},
      link: { textDecorationLine: 'underline' },
      prefixIcon: icon,
      suffixIcon: icon,
      closeButton: {
        width: spacing.x10,
        height: spacing.x10,
        margin: closeBleed,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.r2,
      },
    },
    variants: {
      tone: {
        neutral: toneStyles('neutral'),
        informative: toneStyles('informative'),
        positive: toneStyles('positive'),
        warning: toneStyles('warning'),
        critical: toneStyles('critical'),
        brand: toneStyles('brand'),
        ai: toneStyles('ai'),
      },
    },
    defaultVariants: { tone: 'neutral' },
  } as const;
}
