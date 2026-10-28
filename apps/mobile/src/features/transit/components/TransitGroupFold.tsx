import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { useT, SdsDuration, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { TRANSIT_TITLE_INSET, TransitItemRow } from './TransitItemRow';
import type { TransitGroup, TransitRowItem } from '../transit.types';

interface TransitGroupFoldProps {
  group: TransitGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenRow: (row: TransitRowItem) => void;
  divider?: boolean;
}

export function TransitGroupFold({ group, expanded, onToggle, onOpenRow, divider = true }: TransitGroupFoldProps) {
  const styles = useStyles();
  const semantic = useSemanticColors();
  const { tpl } = useT();
  const Caret = expanded ? CaretUpIcon : CaretDownIcon;
  const label = tpl(expanded ? 'transit.groupHide' : 'transit.groupShow', group.title);

  return (
    <View>
      <Pressable
        bg="neutralWeak"
        style={styles.box}
        onPress={onToggle}
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
      >
        <Txt typography="t4" fontWeight="semibold" color="neutralSubtle" style={styles.label} numberOfLines={1}>
          {label}
        </Txt>
        <Caret size={SdsSpacing.x4} color={semantic.fg.neutralSubtle} weight="bold" />
      </Pressable>
      {expanded && (
        <Animated.View entering={FadeIn.duration(SdsDuration.fast)}>
          {group.items.map((row, i) => (
            <TransitItemRow
              key={row.id}
              item={row}
              inset
              divider={i < group.items.length - 1}
              onPress={() => onOpenRow(row)}
            />
          ))}
        </Animated.View>
      )}
      {divider && <View style={styles.divider} />}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  box: {
    marginLeft: TRANSIT_TITLE_INSET,
    marginRight: SdsSpacing.gutter,
    marginBottom: SdsSpacing.x3,
    minHeight: 44,
    borderRadius: SdsRadius.r2_5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    paddingHorizontal: SdsSpacing.x3_5,
    paddingVertical: SdsSpacing.x2_5,
  },
  label: {
    flex: 1,
  },
  divider: {
    height: 0.5,
    backgroundColor: color.stroke.neutralSubtle,
    marginLeft: SdsSpacing.gutter,
  },
}));
