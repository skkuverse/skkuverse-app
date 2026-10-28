import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { XCircleIcon } from 'phosphor-react-native';
import { SdsDuration, SdsTypeScale } from '@skkuverse/shared';
import { createRecipe } from '../../core/createRecipe';
import { useSemanticColors } from '../../core/theme';
import { useControlled } from '../../utils';
import { Pressable } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import type { ReactNode } from 'react';
import {
  TEXT_FIELD_LABEL_FLOAT,
  TEXT_FIELD_LABEL_REST,
  TEXT_FIELD_PLACEHOLDER,
  textFieldLabelFloats,
  textFieldRecipe,
  type TextFieldLabelOption,
} from './textFieldRecipe';

const useTextFieldRecipe = createRecipe(textFieldRecipe);

export const textFieldVariantMap = useTextFieldRecipe.variantMap;

const INPUT_FONT = { fontSize: SdsTypeScale.t5.fontSize } as const;

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'value' | 'defaultValue' | 'onChangeText'> {
  variant: 'box' | 'line';
  label?: string;
  labelOption?: TextFieldLabelOption;
  help?: ReactNode;
  hasError?: boolean;
  value?: string;
  defaultValue?: string;
  prefix?: string;
  suffix?: string;
  right?: ReactNode;
  disabled?: boolean;
  onChangeText?: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

const TextFieldInner = forwardRef<TextInput, TextFieldProps & { showClear?: boolean; onClear?: () => void }>(
  function TextField(
    {
      variant,
      label,
      labelOption,
      help,
      hasError = false,
      value: _value,
      defaultValue,
      prefix,
      suffix,
      right,
      disabled = false,
      onChangeText,
      containerStyle,
      showClear,
      onClear,
      placeholder,
      ...rest
    },
    ref,
  ) {
    const [value, setValue] = useControlled({
      controlledValue: _value,
      defaultValue: defaultValue ?? '',
    });
    const [focused, setFocused] = useState(false);

    const hasValue = value.length > 0;
    const styles = useTextFieldRecipe({ variant, focused, invalid: hasError, disabled });
    const color = useSemanticColors();

    const shouldFloat = textFieldLabelFloats(labelOption, { focused, hasValue });
    const labelAt = shouldFloat ? TEXT_FIELD_LABEL_FLOAT : TEXT_FIELD_LABEL_REST;
    const labelY = useSharedValue(labelAt.translateY);
    const labelScale = useSharedValue(labelAt.scale);

    useEffect(() => {
      labelY.value = withTiming(labelAt.translateY, { duration: SdsDuration.fast });
      labelScale.value = withTiming(labelAt.scale, { duration: SdsDuration.fast });
    }, [labelAt, labelY, labelScale]);

    const labelAnimStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: labelY.value },
        { scale: labelScale.value },
      ],
    }));

    const handleChangeText = useCallback(
      (text: string) => {
        setValue(text);
        onChangeText?.(text);
      },
      [setValue, onChangeText],
    );

    const handleFocus = useCallback((e: any) => {
      setFocused(true);
      rest.onFocus?.(e);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- depends on the focus handler alone, not on the whole rest object
    }, [rest.onFocus]);

    const handleBlur = useCallback((e: any) => {
      setFocused(false);
      rest.onBlur?.(e);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- depends on the blur handler alone, not on the whole rest object
    }, [rest.onBlur]);

    return (
      <View style={[styles.wrapper, containerStyle]}>
        <View style={styles.container}>
          {label != null && (
            <Animated.View
              style={[styles.labelContainer, labelAnimStyle]}
              pointerEvents="none"
            >
              <Txt typography="t3" style={txtSlot(styles.label)}>
                {label}
              </Txt>
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            {prefix != null && (
              <Txt typography="t7" style={[txtSlot(styles.prefix), label != null && txtSlot(styles.inputWithLabel)]}>
                {prefix}
              </Txt>
            )}
            <TextInput
              ref={ref}
              style={[
                styles.input,
                INPUT_FONT,
                label != null && styles.inputWithLabel,
              ]}
              value={value}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={!shouldFloat ? placeholder : undefined}
              placeholderTextColor={color.fg[TEXT_FIELD_PLACEHOLDER[disabled ? 'disabled' : 'enabled']]}
              editable={!disabled}
              allowFontScaling={false}
              {...rest}
            />
            {suffix != null && (
              <Txt typography="t7" style={[txtSlot(styles.suffix), label != null && txtSlot(styles.inputWithLabel)]}>
                {suffix}
              </Txt>
            )}
            {showClear && hasValue && (
              <Pressable onPress={onClear} hitSlop={8} style={pressableSlot(styles.clearButton)}>
                <XCircleIcon size={20} color={color.fg.neutralFaint} weight="fill" />
              </Pressable>
            )}
            {right}
          </View>
        </View>

        {help != null && (
          <View style={styles.helpContainer}>
            {typeof help === 'string' ? (
              <Txt typography="t3" style={txtSlot(styles.help)}>
                {help}
              </Txt>
            ) : (
              help
            )}
          </View>
        )}
      </View>
    );
  },
);

const ClearableTextField = forwardRef<TextInput, TextFieldProps & { onClear?: () => void }>(
  function ClearableTextField({ onClear, onChangeText, ...props }, ref) {
    const handleClear = useCallback(() => {
      onChangeText?.('');
      onClear?.();
    }, [onChangeText, onClear]);

    return (
      <TextFieldInner
        ref={ref}
        showClear
        onClear={handleClear}
        onChangeText={onChangeText}
        {...props}
      />
    );
  },
);

export const TextField = Object.assign(
  forwardRef<TextInput, TextFieldProps>(function TextField(props, ref) {
    return <TextFieldInner ref={ref} {...props} />;
  }),
  {
    Clearable: ClearableTextField,
  },
);
