/** WHY: buttonRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { BgColorName, FgColorName, SemanticColors } from '@skkuverse/shared';
import type { PressableBgToken } from '../../core/pressFeedback';
import type { RecipeStyle, RecipeTheme } from '../../core/recipe';

export type ButtonTone = 'brand' | 'critical' | 'neutral';
export type ButtonVariant = 'solid' | 'weak';
export type ButtonSize = 'xsmall' | 'small' | 'medium' | 'large';
export type ButtonDisplay = 'inline' | 'block' | 'full';

export interface ButtonDerivedTheme {
  backgroundFillColor: string;
  textFillColor: string;
  pressedFillColor: string;
  backgroundWeakColor: string;
  textWeakColor: string;
  pressedWeakColor: string;
  loaderFillColor: string;
  loaderWeakColor: string;
}

interface ButtonRoles {
  readonly surface: PressableBgToken;
  readonly label: FgColorName;
}

/** WHY: every surface needs its `-pressed` pair; a button on a dark ground is the neutral tone under `ColorSchemeProvider colorMode="dark-only"`. */
export const BUTTON_ROLES: Readonly<Record<ButtonTone, Readonly<Record<ButtonVariant, ButtonRoles>>>> = {
  brand: {
    solid: { surface: 'brandSolid', label: 'onBrandSolid' },
    weak: { surface: 'neutralWeak', label: 'brandContrast' },
  },
  critical: {
    solid: { surface: 'criticalSolid', label: 'onCriticalSolid' },
    weak: { surface: 'neutralWeak', label: 'critical' },
  },
  neutral: {
    solid: { surface: 'neutralSolid', label: 'onNeutralSolid' },
    weak: { surface: 'neutralWeak', label: 'neutralMuted' },
  },
};

/** WHY: `bg.disabled` has no `-pressed` pair and needs none, since a disabled button takes no press. */
export const BUTTON_DISABLED_ROLES = { surface: 'disabled', label: 'disabled' } as const satisfies {
  readonly surface: BgColorName;
  readonly label: FgColorName;
};

export function buttonSurfaceToken(tone: ButtonTone, variant: ButtonVariant): PressableBgToken {
  return BUTTON_ROLES[tone][variant].surface;
}

function surfaceColors(role: PressableBgToken, color: SemanticColors) {
  return { rest: color.bg[role], pressed: color.bg[`${role}Pressed`] };
}

export function buttonColors(tone: ButtonTone, color: SemanticColors): ButtonDerivedTheme {
  const { solid: fill, weak } = BUTTON_ROLES[tone];
  const fillSurface = surfaceColors(fill.surface, color);
  const weakSurface = surfaceColors(weak.surface, color);
  return {
    backgroundFillColor: fillSurface.rest,
    textFillColor: color.fg[fill.label],
    pressedFillColor: fillSurface.pressed,
    loaderFillColor: color.fg[fill.label],
    backgroundWeakColor: weakSurface.rest,
    textWeakColor: color.fg[weak.label],
    pressedWeakColor: weakSurface.pressed,
    loaderWeakColor: color.fg[weak.label],
  };
}

const TONES: readonly ButtonTone[] = ['brand', 'critical', 'neutral'];

const absoluteFill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export function buttonSizeStyles({ spacing, radius }: Pick<RecipeTheme, 'spacing' | 'radius'>) {
  return {
    xsmall: {
      paddingHorizontal: spacing.x2_5,
      paddingVertical: spacing.x0_5,
      minHeight: 32,
      minWidth: 52,
      borderRadius: radius.r2,
    },
    small: {
      paddingHorizontal: spacing.x4,
      paddingVertical: spacing.x0_5,
      minHeight: 38,
      minWidth: 64,
      borderRadius: radius.r2_5,
    },
    medium: {
      paddingHorizontal: spacing.x4,
      paddingVertical: spacing.x0_5,
      minHeight: 48,
      minWidth: 80,
      borderRadius: radius.r3_5,
    },
    large: {
      paddingHorizontal: spacing.x7,
      paddingVertical: spacing.x0_5,
      minHeight: 56,
      minWidth: 96,
      borderRadius: radius.r4,
    },
  } satisfies Record<ButtonSize, RecipeStyle>;
}

export const buttonContainerBase = {
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  position: 'relative',
} as const satisfies RecipeStyle;

export function buttonRecipe({ color, spacing, radius }: RecipeTheme) {
  const size = buttonSizeStyles({ spacing, radius });
  return {
    base: {
      root: {},
      container: buttonContainerBase,
      surface: absoluteFill,
      content: { flexDirection: 'row', alignItems: 'center' },
      // WHY: a wrapper rather than a row `gap`, because children may render as several nodes and a gap would space those apart too.
      leftAccessory: { marginRight: spacing.x1_5 },
      label: {},
      // WHY: the dots sit over the surface and the content hides while loading, so a translucent surface neither doubles nor shows the label through.
      loading: { ...absoluteFill, justifyContent: 'center', alignItems: 'center' },
      // eslint-disable-next-line sds/no-spacing-literal -- the loading dots' spacing as drawn, pinned by buttonRecipe.test.mts with the rest of the slots
      dots: { flexDirection: 'row', gap: 7 },
      dot: { width: 8, height: 8, borderRadius: radius.full },
    },
    variants: {
      tone: { brand: {}, critical: {}, neutral: {} },
      variant: { solid: {}, weak: {} },
      size: {
        xsmall: { container: size.xsmall },
        small: { container: size.small },
        medium: { container: size.medium },
        large: { container: size.large },
      },
      display: {
        inline: { root: { alignSelf: 'flex-start' } },
        block: {},
        full: { container: { borderRadius: 0 } },
      },
      disabled: { true: {}, false: {} },
      loading: { true: {}, false: {} },
    },
    compoundVariants: [
      ...TONES.flatMap((tone) => {
        const c = buttonColors(tone, color);
        return [
          {
            tone,
            variant: 'solid' as const,
            style: {
              surface: { backgroundColor: c.backgroundFillColor },
              label: { color: c.textFillColor },
              dot: { backgroundColor: c.loaderFillColor },
            },
          },
          {
            tone,
            variant: 'weak' as const,
            style: {
              surface: { backgroundColor: c.backgroundWeakColor },
              label: { color: c.textWeakColor },
              dot: { backgroundColor: c.loaderWeakColor },
            },
          },
        ];
      }),
      // WHY: after the tones, so the disabled roles win over them.
      {
        disabled: true,
        style: {
          surface: { backgroundColor: color.bg[BUTTON_DISABLED_ROLES.surface] },
          label: { color: color.fg[BUTTON_DISABLED_ROLES.label] },
          // eslint-disable-next-line sds/role-placement -- the loading dots are the label's glyph, drawn as Views, so they take its fg role as every tone's dots do
          dot: { backgroundColor: color.fg[BUTTON_DISABLED_ROLES.label] },
        },
      },
      { loading: true, style: { content: { opacity: 0 } } },
    ],
    defaultVariants: {
      tone: 'brand',
      variant: 'solid',
      size: 'large',
      display: 'inline',
      disabled: false,
      loading: false,
    },
  } as const;
}
