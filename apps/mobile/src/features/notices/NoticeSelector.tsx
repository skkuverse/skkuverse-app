import { View } from 'react-native';
import { CaretDownIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';

interface Props {
  label: string;
  onPress: () => void;
}

export function NoticeSelector({ label, onPress }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  return (
    // WHY: the line under the row sits outside the press, so the full-width row shrinks its content (PRESS-10).
    <View style={styles.surface}>
    <Pressable onPress={onPress} bg="neutralMuted" scaleScope="content" style={styles.row} contentStyle={styles.content}>
      <Txt
        typography="t3"
        color="neutralSubtle"
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
      <CaretDownIcon size={14} color={color.fg.placeholder} />
    </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  surface: {
    borderBottomWidth: 1,
    borderBottomColor: color.stroke.neutralSubtle,
  },
  row: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x3_5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  label: {
    flex: 1,
  },
}));
