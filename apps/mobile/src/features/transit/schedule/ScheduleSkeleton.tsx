import { View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Skeleton, createThemedStyles } from '@skkuverse/sds';

export function ScheduleSkeleton() {
  const styles = useStyles();
  return (
    <Skeleton.Animate>
      <View style={styles.container}>
        <View style={styles.controlsCard}>
          <Skeleton width="100%" height={36} borderRadius={SdsRadius.r2_5} />

          <View style={styles.weekHeader}>
            <Skeleton width={90} height={16} borderRadius={SdsRadius.r1} />
            <View style={styles.weekNav}>
              <Skeleton width={28} height={28} borderRadius={SdsRadius.r2} />
              <Skeleton width={28} height={28} borderRadius={SdsRadius.r2} />
            </View>
          </View>

          <View style={styles.dayGrid}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.dayCell}>
                <Skeleton width={20} height={16} borderRadius={SdsRadius.r1} />
                <Skeleton width={14} height={12} borderRadius={SdsRadius.r1} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.timetableCard}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={styles.scheduleRow}>
              <Skeleton width={8} height={8} borderRadius={SdsRadius.r1} />
              <Skeleton width={60} height={16} borderRadius={SdsRadius.r1} />
            </View>
          ))}
        </View>
      </View>
    </Skeleton.Animate>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    gap: SdsSpacing.x2,
  },
  controlsCard: {
    backgroundColor: color.bg.layerDefault,
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x4_5,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SdsSpacing.x4,
    marginBottom: SdsSpacing.x2_5,
  },
  weekNav: {
    flexDirection: 'row',
    gap: SdsSpacing.x0_5,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: SdsSpacing.x1,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SdsSpacing.x2_5,
    gap: SdsSpacing.x1,
  },
  timetableCard: {
    backgroundColor: color.bg.layerDefault,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x2_5,
    gap: SdsSpacing.x2_5,
  },
}));
