import { View } from 'react-native';
import { CheckIcon, WarningCircleIcon } from 'phosphor-react-native';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

interface Props {
  name: string;
  selected: boolean;
  disabled?: boolean;
  /** WHY: greyed but still pressable, so an unsupported department can open its explanation. */
  unsupported?: boolean;
  variant: 'radio' | 'checkbox';
  onPress: () => void;
}

export function DeptRow({
  name,
  selected,
  disabled = false,
  unsupported = false,
  variant,
  onPress,
}: Props) {
  const styles = useStyles();
  const dimmed = disabled || unsupported;
  const color = useSemanticColors();
  const brandStyles = useBrandStyles();

  return (
    // WHY: the fill and the check show the selection, so a press only shrinks the row (PRESS-06).
    <Pressable
      bg={selected ? 'positiveWeak' : 'transparent'}
      feedback="scale"
      style={styles.row}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={variant}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={name}
    >
      <Txt
        typography="t5"
        fontWeight={selected ? 'semiBold' : 'medium'}
        color={
          dimmed
            ? 'disabled'
            : selected
              ? 'brandContrast'
              : 'neutral'
        }
        style={styles.name}
      >
        {name}
      </Txt>
      {unsupported && (
        // WHY: without a marker a greyed row reads as broken, not as "tap to learn why".
        <WarningCircleIcon
          size={16}
          color={color.fg.placeholder}
          weight="fill"
          style={styles.warnIcon}
        />
      )}
      <View
        style={[
          variant === 'radio' ? styles.radio : styles.checkbox,
          selected && brandStyles.indicatorSelected,
          dimmed && !selected && styles.indicatorDisabled,
        ]}
      >
        {selected && <CheckIcon size={10} color={color.fg.onBrandSolid} />}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SdsSpacing.x4,
    paddingHorizontal: SdsSpacing.x3,
    borderRadius: SdsRadius.r2_5,
  },
  name: {
    flex: 1,
  },
  warnIcon: {
    marginRight: SdsSpacing.x2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: SdsRadius.full,
    borderWidth: 1.5,
    borderColor: color.stroke.neutralMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: SdsRadius.r1_5,
    borderWidth: 1.5,
    borderColor: color.stroke.neutralMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDisabled: {
    borderColor: color.stroke.neutralSubtle,
    backgroundColor: color.bg.neutralMuted,
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  indicatorSelected: {
    // eslint-disable-next-line sds/role-placement -- the border is part of the fill and must equal it in both schemes; stroke.brandSolid differs from bg.brandSolid in dark
    borderColor: color.bg.brandSolid,
    backgroundColor: color.bg.brandSolid,
  },
}));
