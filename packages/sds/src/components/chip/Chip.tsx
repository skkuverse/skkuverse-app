import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewProps,
} from 'react-native';
import { createRecipe } from '../../core/createRecipe';
import { useSurface } from '../../core/SurfaceContext';
import type { RecipeStyles } from '../../core/recipe';
import { useControllableState } from '../../utils/useControllableState';
import { IconSlot } from '../icon-slot/IconSlot';
import { Pressable, type PressableProps, type PressableStyle } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt, type TxtProps } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import {
  CHIP_LABEL_TEXT,
  chipRecipe,
  chipDisabledSurface,
  chipSurface,
  type ChipSize,
  type ChipTone,
  type ChipVariant,
} from './chipRecipe';
import {
  chipAccessibility,
  chipFeedback,
  isRadioItemSelected,
  togglePressed,
  type ChipKind,
} from './chipState';

const useChipRecipe = createRecipe(chipRecipe);

export const chipVariantMap = useChipRecipe.variantMap;

type ChipStyles = RecipeStyles<'root' | 'label' | 'prefixIcon' | 'suffixIcon'>;

const ChipStylesContext = createContext<ChipStyles | null>(null);

function useChipStyles(part: string): ChipStyles {
  const styles = useContext(ChipStylesContext);
  if (!styles) throw new Error(`<Chip.${part}> must be rendered inside a Chip.`);
  return styles;
}

interface ChipPartProps
  extends Omit<
    PressableProps,
    'bg' | 'feedback' | 'scaleScope' | 'contentStyle' | 'loading' | 'style' | 'children'
  > {
  variant?: ChipVariant;
  size?: ChipSize;
  disabled?: boolean;
  style?: StyleProp<PressableStyle>;
  children: ReactNode;
}

interface ChipRootProps extends ChipPartProps {
  kind: ChipKind;
  tone: ChipTone;
  selected: boolean;
}

const ChipRoot = forwardRef<View, ChipRootProps>(function ChipRoot(
  {
    kind,
    variant = 'solid',
    tone,
    size = 'medium',
    selected,
    disabled = false,
    style,
    accessibilityState,
    children,
    ...rest
  },
  ref,
) {
  const styles = useChipRecipe({ variant, tone, size, selected, disabled });
  const surface = useSurface();
  const a11y = chipAccessibility(kind, { selected, disabled });
  const state: AccessibilityState = { ...a11y.state, ...accessibilityState };

  return (
    <Pressable
      ref={ref}
      bg={chipSurface(variant, tone, selected, surface)}
      disabledBg={chipDisabledSurface(surface)}
      feedback={chipFeedback(selected)}
      disabled={disabled}
      accessibilityRole={a11y.role}
      accessibilityState={state}
      style={[pressableSlot(styles.root), style]}
      {...rest}
    >
      <ChipStylesContext.Provider value={styles}>{children}</ChipStylesContext.Provider>
    </Pressable>
  );
});

export type ChipButtonProps = ChipPartProps;

export const ChipButton = forwardRef<View, ChipButtonProps>(function ChipButton(props, ref) {
  return <ChipRoot ref={ref} kind="button" tone="neutral" selected={false} {...props} />;
});

export interface ChipToggleProps extends ChipPartProps {
  tone?: ChipTone;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const ChipToggle = forwardRef<View, ChipToggleProps>(function ChipToggle(
  { tone = 'neutral', checked: checkedProp, defaultChecked = false, onCheckedChange, onPress, ...rest },
  ref,
) {
  const [checked, setChecked] = useControllableState({
    value: checkedProp,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });

  return (
    <ChipRoot
      ref={ref}
      kind="toggle"
      tone={tone}
      selected={checked}
      onPress={(event) => {
        setChecked(togglePressed(checked));
        onPress?.(event);
      }}
      {...rest}
    />
  );
});

interface ChipRadioGroupValue {
  value: string | null;
  setValue: (value: string) => void;
  disabled: boolean;
}

const ChipRadioGroupContext = createContext<ChipRadioGroupValue | null>(null);

export interface ChipRadioRootProps extends ViewProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

export const ChipRadioRoot = forwardRef<View, ChipRadioRootProps>(function ChipRadioRoot(
  { value: valueProp, defaultValue, onValueChange, disabled = false, children, ...rest },
  ref,
) {
  const handleChange = useCallback(
    (next: string | null) => {
      if (next !== null) onValueChange?.(next);
    },
    [onValueChange],
  );
  const [value, setValue] = useControllableState<string | null>({
    value: valueProp,
    defaultValue: defaultValue ?? null,
    onChange: handleChange,
  });
  const group = useMemo<ChipRadioGroupValue>(
    () => ({ value, setValue, disabled }),
    [value, setValue, disabled],
  );

  return (
    <View ref={ref} accessibilityRole="radiogroup" {...rest}>
      <ChipRadioGroupContext.Provider value={group}>{children}</ChipRadioGroupContext.Provider>
    </View>
  );
});

export interface ChipRadioItemProps extends ChipPartProps {
  value: string;
  tone?: ChipTone;
}

export const ChipRadioItem = forwardRef<View, ChipRadioItemProps>(function ChipRadioItem(
  { value: itemValue, tone = 'neutral', disabled = false, onPress, ...rest },
  ref,
) {
  const group = useContext(ChipRadioGroupContext);
  if (!group) throw new Error('<Chip.RadioItem> must be rendered inside <Chip.RadioRoot>.');

  return (
    <ChipRoot
      ref={ref}
      kind="radio"
      tone={tone}
      selected={isRadioItemSelected(group.value, itemValue)}
      disabled={group.disabled || disabled}
      onPress={(event) => {
        group.setValue(itemValue);
        onPress?.(event);
      }}
      {...rest}
    />
  );
});

export type ChipLabelProps = Omit<TxtProps, 'typography' | 'fontWeight' | 'color'>;

export function ChipLabel({ style, numberOfLines = 1, ...rest }: ChipLabelProps) {
  const styles = useChipStyles('Label');
  return (
    <Txt
      typography={CHIP_LABEL_TEXT.typography}
      fontWeight={CHIP_LABEL_TEXT.fontWeight}
      numberOfLines={numberOfLines}
      style={[txtSlot(styles.label), style]}
      {...rest}
    />
  );
}

export interface ChipIconProps {
  children: ReactNode;
}

function ChipIconSlot({ slot, part, children }: ChipIconProps & { slot: 'prefixIcon' | 'suffixIcon'; part: string }) {
  const styles = useChipStyles(part);
  return (
    <IconSlot box={styles[slot]} color={styles.label.color}>
      {children}
    </IconSlot>
  );
}

export function ChipPrefixIcon({ children }: ChipIconProps) {
  return (
    <ChipIconSlot slot="prefixIcon" part="PrefixIcon">
      {children}
    </ChipIconSlot>
  );
}

export function ChipSuffixIcon({ children }: ChipIconProps) {
  return (
    <ChipIconSlot slot="suffixIcon" part="SuffixIcon">
      {children}
    </ChipIconSlot>
  );
}

export const Chip = {
  Button: ChipButton,
  Toggle: ChipToggle,
  RadioRoot: ChipRadioRoot,
  RadioItem: ChipRadioItem,
  Label: ChipLabel,
  PrefixIcon: ChipPrefixIcon,
  SuffixIcon: ChipSuffixIcon,
};
