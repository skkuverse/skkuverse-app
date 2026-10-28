import React, { forwardRef, type ReactNode } from 'react';
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { createRecipe } from '../../core/createRecipe';
import { PressableScopeContext, usePressFeedback } from '../../core/usePressFeedback';
import { ICON_BUTTON_SURFACE, iconButtonRecipe, iconButtonSize, type IconButtonVariant } from './iconButtonRecipe';

export interface IconButtonProps {
  icon: ReactNode;
  iconSize?: number;
  variant?: IconButtonVariant;
  disabled?: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

const useIconButtonRecipe = createRecipe(iconButtonRecipe);

export const iconButtonVariantMap = useIconButtonRecipe.variantMap;

export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    icon,
    iconSize = 24,
    variant = 'ghost',
    disabled = false,
    label,
    onPress,
    style,
  },
  ref,
) {
  const styles = useIconButtonRecipe({ variant, disabled });
  const size = iconButtonSize(iconSize);

  const press = usePressFeedback({ bg: ICON_BUTTON_SURFACE[variant], disabled });

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      ref={ref}
      style={[styles.root, style]}
      {...press.triggerProps}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size },
          press.surfaceAnimatedStyle,
          press.targetAnimatedStyle,
        ]}
      >
        <PressableScopeContext.Provider value={press.scope}>{icon}</PressableScopeContext.Provider>
      </Animated.View>
    </Pressable>
  );
});
