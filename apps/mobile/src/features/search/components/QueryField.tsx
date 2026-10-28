import { View, TextInput } from 'react-native';
import { MagnifyingGlassIcon, XCircleIcon } from 'phosphor-react-native';
import { SdsTypo, SdsSpacing, SdsRadius } from '@skkuverse/shared';
import { Pressable, createThemedStyles, useSemanticColors } from '@skkuverse/sds';

interface QueryFieldProps {
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export function QueryField({ value, placeholder, onChangeText, onClear }: QueryFieldProps) {
  const color = useSemanticColors();
  const styles = useStyles();

  return (
    <View style={styles.wrapper}>
      <View style={styles.field}>
        <MagnifyingGlassIcon size={18} color={color.fg.neutralSubtle} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={color.fg.placeholder}
          value={value}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8} bg="transparent" style={styles.clearButton}>
            <XCircleIcon size={18} color={color.fg.placeholder} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  wrapper: {
    paddingHorizontal: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bg.neutralMuted,
    borderRadius: SdsRadius.r3_5,
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x3_5,
    gap: SdsSpacing.x2_5,
  },
  input: {
    flex: 1,
    fontFamily: SdsTypo.t7Regular.fontFamily,
    fontSize: SdsTypo.t7Regular.fontSize,
    fontWeight: SdsTypo.t7Regular.fontWeight,
    color: color.fg.neutral,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    borderRadius: SdsRadius.full,
  },
}));
