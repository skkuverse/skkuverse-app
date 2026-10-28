import React, { type ReactNode } from 'react';
import { type GestureResponderEvent, type StyleProp } from 'react-native';
import type { FgColorName } from '@skkuverse/shared';
import { useSemanticColors } from '../../core/theme';
import { createRecipe } from '../../core/createRecipe';
import type { TypographyKeys } from '../../foundation/typography';
import { Pressable, type PressableStyle } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import { TEXT_BUTTON_ARROW, textButtonRecipe } from './textButtonRecipe';

export interface TextButtonProps {
  children: ReactNode;
  typography: TypographyKeys;
  variant?: 'arrow' | 'underline' | 'clear';
  fontWeight?: 'regular' | 'medium' | 'semiBold' | 'bold';
  color?: FgColorName;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  style?: StyleProp<PressableStyle>;
}

const useTextButtonRecipe = createRecipe(textButtonRecipe);

export const textButtonVariantMap = useTextButtonRecipe.variantMap;

export function TextButton({
  children,
  typography,
  variant = 'clear',
  fontWeight = 'regular',
  color,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: TextButtonProps) {
  const styles = useTextButtonRecipe({ variant, disabled });
  const semantic = useSemanticColors();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[pressableSlot(styles.root), style]}
    >
      <Txt
        typography={typography}
        fontWeight={fontWeight}
        style={[txtSlot(styles.label), !disabled && color !== undefined && { color: semantic.fg[color] }]}
      >
        {children}
        {variant === 'arrow' ? TEXT_BUTTON_ARROW : ''}
      </Txt>
    </Pressable>
  );
}
