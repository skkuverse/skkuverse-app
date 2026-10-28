import React, { forwardRef, useCallback } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MagnifyingGlassIcon, XCircleIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing, SdsTypeScale } from '@skkuverse/shared';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { useControlled } from '../../utils';
import { Pressable } from '../pressable';


export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  hasClearButton?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  {
    value: _value,
    defaultValue,
    onChangeText,
    hasClearButton = false,
    style,
    placeholder,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControlled({
    controlledValue: _value,
    defaultValue: defaultValue ?? '',
  });

  const handleChangeText = useCallback(
    (text: string) => {
      setValue(text);
      onChangeText?.(text);
    },
    [setValue, onChangeText],
  );

  const handleClear = useCallback(() => {
    setValue('');
    onChangeText?.('');
  }, [setValue, onChangeText]);

  const showClear = hasClearButton && value.length > 0;
  const styles = useStyles();
  const color = useSemanticColors();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconLeft}>
        <MagnifyingGlassIcon size={20} color={color.fg.placeholder} />
      </View>
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.fg.placeholder}
        returnKeyType="search"
        allowFontScaling={false}
        {...rest}
      />
      {showClear && (
        <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
          <XCircleIcon size={20} color={color.fg.neutralFaint} weight="fill" />
        </Pressable>
      )}
    </View>
  );
});

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bg.neutralWeak,
    borderRadius: SdsRadius.r3,
    paddingHorizontal: SdsSpacing.x3,
    height: 44,
  },
  iconLeft: {
    marginRight: SdsSpacing.x2,
  },
  input: {
    flex: 1,
    fontSize: SdsTypeScale.t5.fontSize,
    color: color.fg.neutral,
    padding: 0,
  },
  clearButton: {
    marginLeft: SdsSpacing.x2,
  },
}));
