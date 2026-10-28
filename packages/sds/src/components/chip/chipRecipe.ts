/** WHY: chipRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { BgColorName, FgColorName, StrokeColorName } from '@skkuverse/shared';
import type { PressableBgToken } from '../../core/pressFeedback';
import type { RecipeTheme } from '../../core/recipe';
import type { Surface } from '../../core/surface';

export type ChipVariant = 'solid' | 'outlineWeak';
export type ChipTone = 'neutral' | 'brand';
export type ChipSize = 'small' | 'medium' | 'large';

type ChipColorState = 'rest' | ChipTone;

export const CHIP_SURFACE = {
  solid: { rest: 'neutralWeak', neutral: 'neutralSolid', brand: 'brandSolid' },
  outlineWeak: { rest: 'transparent', neutral: 'neutralWeak', brand: 'brandWeak' },
} as const satisfies Record<ChipVariant, Record<ChipColorState, PressableBgToken>>;

export const CHIP_LABEL = {
  solid: { rest: 'neutral', neutral: 'onNeutralSolid', brand: 'onBrandSolid' },
  outlineWeak: { rest: 'neutral', neutral: 'neutral', brand: 'brandContrast' },
} as const satisfies Record<ChipVariant, Record<ChipColorState, FgColorName>>;

export const CHIP_STROKE = {
  rest: 'neutralMuted',
  neutral: 'neutralContrast',
  brand: 'brandSolid',
} as const satisfies Record<ChipColorState, StrokeColorName>;

/** WHY: Pressable draws this surface while disabled (`disabledBg`), so no press reaches the `-pressed` pair `bg.disabled` lacks. */
export const CHIP_DISABLED = { surface: 'disabled', label: 'disabled' } as const satisfies {
  readonly surface: BgColorName;
  readonly label: FgColorName;
};

export const CHIP_LABEL_TEXT = { typography: 't4', fontWeight: 'medium' } as const;

function colorState(tone: ChipTone, selected: boolean): ChipColorState {
  return selected ? tone : 'rest';
}

/** WHY: on a glass sheet `neutralWeak` vanishes into the veil, so a solid chip at rest takes the translucent `glassControl`; a selected tone already reads there. */
export function chipSurface(
  variant: ChipVariant,
  tone: ChipTone,
  selected: boolean,
  surface: Surface = 'opaque',
): PressableBgToken {
  if (surface === 'glass' && variant === 'solid' && !selected) return 'glassControl';
  return CHIP_SURFACE[variant][colorState(tone, selected)];
}

/** WHY: on glass a disabled chip keeps the translucent fill, so a placeholder chip stays legible. */
export function chipDisabledSurface(surface: Surface = 'opaque'): BgColorName {
  return surface === 'glass' ? 'glassControl' : CHIP_DISABLED.surface;
}

const TONES: readonly ChipTone[] = ['neutral', 'brand'];

export function chipRecipe({ color, spacing, radius }: RecipeTheme) {
  return {
    base: {
      root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: radius.full,
      },
      // WHY: the label shrinks, so a long one ellipsises before the icons give way.
      label: { paddingHorizontal: spacing.x1_5, flexShrink: 1 },
      prefixIcon: { alignItems: 'center', justifyContent: 'center', marginLeft: spacing.x1_5 },
      suffixIcon: { alignItems: 'center', justifyContent: 'center', marginRight: spacing.x1_5 },
    },
    variants: {
      variant: {
        solid: {
          root: { backgroundColor: color.bg[CHIP_SURFACE.solid.rest] },
          label: { color: color.fg[CHIP_LABEL.solid.rest] },
        },
        outlineWeak: {
          root: {
            backgroundColor: color.bg[CHIP_SURFACE.outlineWeak.rest],
            borderWidth: 1,
            borderColor: color.stroke[CHIP_STROKE.rest],
          },
          label: { color: color.fg[CHIP_LABEL.outlineWeak.rest] },
        },
      },
      tone: { neutral: {}, brand: {} },
      size: {
        small: {
          root: { height: 32, minWidth: 44, paddingHorizontal: spacing.x1_5 },
          prefixIcon: { width: spacing.x3_5, height: spacing.x3_5 },
          suffixIcon: { width: spacing.x3_5, height: spacing.x3_5 },
        },
        medium: {
          root: { height: 36, minWidth: spacing.x12, paddingHorizontal: spacing.x2 },
          prefixIcon: { width: spacing.x4, height: spacing.x4 },
          suffixIcon: { width: spacing.x3_5, height: spacing.x3_5 },
        },
        large: {
          root: { height: 40, minWidth: spacing.x13, paddingHorizontal: spacing.x2_5 },
          prefixIcon: { width: spacing.x4, height: spacing.x4 },
          suffixIcon: { width: spacing.x4, height: spacing.x4 },
        },
      },
      selected: { true: {}, false: {} },
      // WHY: the disabled compound comes last, so it wins over a selected tone.
      disabled: { true: {}, false: {} },
    },
    compoundVariants: [
      ...TONES.flatMap((tone) => [
        {
          variant: 'solid' as const,
          tone,
          selected: true,
          style: {
            root: { backgroundColor: color.bg[CHIP_SURFACE.solid[tone]] },
            label: { color: color.fg[CHIP_LABEL.solid[tone]] },
          },
        },
        {
          variant: 'outlineWeak' as const,
          tone,
          selected: true,
          style: {
            root: {
              backgroundColor: color.bg[CHIP_SURFACE.outlineWeak[tone]],
              borderColor: color.stroke[CHIP_STROKE[tone]],
            },
            label: { color: color.fg[CHIP_LABEL.outlineWeak[tone]] },
          },
        },
      ]),
      {
        disabled: true,
        style: {
          root: { backgroundColor: color.bg[CHIP_DISABLED.surface] },
          label: { color: color.fg[CHIP_DISABLED.label] },
        },
      },
      {
        variant: 'outlineWeak' as const,
        disabled: true,
        style: { root: { borderColor: color.stroke[CHIP_STROKE.rest] } },
      },
    ],
    defaultVariants: {
      variant: 'solid',
      tone: 'neutral',
      size: 'medium',
      selected: false,
      disabled: false,
    },
  } as const;
}
