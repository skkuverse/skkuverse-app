import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, Txt } from '@skkuverse/sds';
import type { SduiSectionTitle as SectionTitleType } from '@/features/map/campus-sheet/campus-sheet.types';

interface Props {
  section: SectionTitleType;
}

export function SectionTitle({ section }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Txt typography="t6" fontWeight="bold" style={styles.title}>{section.title}</Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x1,
  },
  title: {
    color: color.fg.neutral,
  },
}));
