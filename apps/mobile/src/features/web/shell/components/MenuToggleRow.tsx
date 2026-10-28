import { View } from 'react-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Switch, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';

/** WHY: only the Switch is pressable: a stray tap on the row would flip the subscription unseen. */
export function MenuToggleRow({
  icon: IconCmp,
  label,
  hint,
  value,
  onValueChange,
}: {
  icon: PhosphorIcon;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const color = useSemanticColors();
  const styles = useStyles();
  return (
    <View style={styles.menuRow}>
      <IconCmp size={22} color={color.fg.neutral} />
      <View style={styles.menuToggleTexts}>
        <Txt typography="t7" color="neutral">
          {label}
        </Txt>
        {hint ? (
          <Txt typography="t3" color="neutralSubtle">
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch checked={value} onCheckedChange={onValueChange} accessibilityLabel={label} />
    </View>
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
  menuToggleTexts: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
}));
