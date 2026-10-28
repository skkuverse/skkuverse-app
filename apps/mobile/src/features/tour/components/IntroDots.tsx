import { View } from 'react-native';
import { createThemedStyles } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

interface Props {
  count: number;
  activeIndex: number;
}

// WHY: dots, not the SDS ProgressBar: the tour swipes both ways and a bar reads as irreversible
// progress. The active dot widens, not only recolours, so a colour-blind reader sees the position.
export function IntroDots({ count, activeIndex }: Props) {
  const styles = useStyles();
  const brandStyles = useBrandStyles();

  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === activeIndex && [styles.dotActive, brandStyles.dotActive],
          ]}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    height: 32,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: SdsRadius.full,
    backgroundColor: color.stroke.neutralWeak,
  },
  dotActive: {
    width: 18,
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  dotActive: {
    backgroundColor: color.bg.brandSolid,
  },
}));
