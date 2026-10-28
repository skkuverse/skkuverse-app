import { View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Skeleton, createThemedStyles } from '@skkuverse/sds';

export function NoticeListSkeleton() {
  const styles = useStyles();
  return (
    <Skeleton.Animate>
      <View style={styles.container}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={48} height={18} borderRadius={SdsRadius.r1_5} />
            <Skeleton width="90%" height={18} borderRadius={SdsRadius.r1} />
            <Skeleton width="60%" height={14} borderRadius={SdsRadius.r1} />
          </View>
        ))}
      </View>
    </Skeleton.Animate>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    backgroundColor: color.bg.layerDefault,
  },
  row: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x4_5,
    gap: SdsSpacing.x2,
    borderBottomWidth: 0.5,
    borderBottomColor: color.stroke.neutralSubtle,
  },
}));
