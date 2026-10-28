/** WHY: textFieldRecipe.test.mts loads this file under plain Node, so it imports types only. */
import type { FgColorName } from '@skkuverse/shared';
import type { RecipeTheme } from '../../core/recipe';

export type TextFieldVariant = 'box' | 'line';

export const TEXT_FIELD_PLACEHOLDER = {
  enabled: 'placeholder',
  disabled: 'disabled',
} as const satisfies Record<'enabled' | 'disabled', FgColorName>;

export const TEXT_FIELD_LABEL_REST = { translateY: 18, scale: 1 } as const;
export const TEXT_FIELD_LABEL_FLOAT = { translateY: 0, scale: 0.75 } as const;

export type TextFieldLabelOption = 'appear' | 'sustain';

/** WHY: `sustain` by default, so a field keeps its label visible and the placeholder never stands in for it (FIELD-02). */
export function textFieldLabelFloats(
  labelOption: TextFieldLabelOption | undefined,
  state: { focused: boolean; hasValue: boolean },
): boolean {
  return (labelOption ?? 'sustain') === 'sustain' || state.focused || state.hasValue;
}

export function textFieldRecipe({ color, spacing, radius }: RecipeTheme) {
  const line = (value: string) => ({ borderColor: value, borderBottomColor: value });
  return {
    base: {
      wrapper: { width: '100%' },
      container: {
        justifyContent: 'center',
        minHeight: 56,
        paddingTop: spacing.x2,
        paddingBottom: spacing.x2,
        ...line(color.stroke.neutralWeak),
      },
      labelContainer: { position: 'absolute', top: spacing.x2, transformOrigin: 'left top' },
      label: { color: color.fg.neutralSubtle },
      inputRow: { flexDirection: 'row', alignItems: 'center' },
      // WHY: the input keeps the system font at t5's size, set by the component; WantedSans or t5's line height would change how the input draws.
      input: { flex: 1, color: color.fg.neutral, padding: 0 },
      inputWithLabel: { marginTop: spacing.x3_5 },
      prefix: { marginRight: spacing.x1, color: color.fg.neutralSubtle },
      suffix: { marginLeft: spacing.x1, color: color.fg.neutralSubtle },
      clearButton: { marginLeft: spacing.x2 },
      helpContainer: { marginTop: spacing.x1_5, paddingHorizontal: spacing.x1 },
      help: { color: color.fg.neutralSubtle },
    },
    variants: {
      variant: {
        box: {
          container: { borderWidth: 1, borderRadius: radius.r3, paddingHorizontal: spacing.x4 },
          labelContainer: { left: spacing.x4 },
        },
        line: {
          container: { borderBottomWidth: 1, paddingHorizontal: 0 },
          labelContainer: { left: 0 },
        },
      },
      focused: {
        true: { container: line(color.stroke.informativeSolid), label: { color: color.fg.informative } },
        false: {},
      },
      // WHY: after `focused`, so an error wins while focused.
      invalid: {
        true: {
          container: line(color.stroke.criticalSolid),
          label: { color: color.fg.critical },
          help: { color: color.fg.critical },
        },
        false: {},
      },
      disabled: {
        true: {
          label: { color: color.fg.disabled },
          input: { color: color.fg.disabled },
          prefix: { color: color.fg.disabled },
          suffix: { color: color.fg.disabled },
        },
        false: {},
      },
    },
    compoundVariants: [{ variant: 'box', disabled: true, style: { container: { backgroundColor: color.bg.disabled } } }],
    defaultVariants: { variant: 'box', focused: false, invalid: false, disabled: false },
  } as const;
}
