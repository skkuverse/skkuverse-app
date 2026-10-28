import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';

/** WHY: the icon is a phosphor component, since the sheet is JSX, unlike the header. */
export function MenuRow({
  icon: IconCmp,
  label,
  onPress,
}: {
  icon: PhosphorIcon;
  label: string;
  onPress: () => void;
}) {
  const color = useSemanticColors();
  const styles = useStyles();
  return (
    <Pressable
      bg="layerFloating"
      onPress={onPress}
      style={styles.menuRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconCmp size={22} color={color.fg.neutral} />
      <Txt typography="t7" color="neutral">
        {label}
      </Txt>
    </Pressable>
  );
}


const useStyles = createThemedStyles(() => ({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x3_5,
    paddingHorizontal: SdsSpacing.x1,
    borderRadius: SdsRadius.r2,
  },
}));
