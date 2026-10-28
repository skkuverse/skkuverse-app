import { Platform, View } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { SdsSpacing, useT, type TranslationKey } from '@skkuverse/shared';
import { SegmentedControl, createThemedStyles } from '@skkuverse/sds';
import type { CampusCounts } from '@/features/map/building/building.types';
import type { CampusFilter } from '../useSearch';

const GLASS_AVAILABLE = isLiquidGlassAvailable();
const CAMPUS_FILTERS = [
  { id: 'all', label: 'common.total', count: 'total' },
  { id: 'hssc', label: 'campus.hssc', count: 'hssc' },
  { id: 'nsc', label: 'campus.nsc', count: 'nsc' },
] as const satisfies readonly { id: CampusFilter; label: TranslationKey; count: keyof CampusCounts }[];

interface CampusFilterControlProps {
  value: CampusFilter;
  counts: CampusCounts | null;
  onChange: (filter: CampusFilter) => void;
}

export function CampusFilterControl({ value, counts, onChange }: CampusFilterControlProps) {
  const styles = useStyles();
  const { t } = useT();
  const labels = CAMPUS_FILTERS.map(({ label, count }) => (counts ? `${t(label)} ${counts[count]}` : t(label)));

  return (
    <View style={styles.wrapper}>
      {Platform.OS === 'ios' && GLASS_AVAILABLE ? (
        <NativeSegmentedControl
          values={labels}
          selectedIndex={Math.max(0, CAMPUS_FILTERS.findIndex((f) => f.id === value))}
          onChange={(e) => {
            const filter = CAMPUS_FILTERS[e.nativeEvent.selectedSegmentIndex]?.id;
            if (!filter) return;
            onChange(filter);
          }}
          style={styles.native}
        />
      ) : (
        <SegmentedControl value={value} onValueChange={(v) => onChange(v as CampusFilter)}>
          {CAMPUS_FILTERS.map(({ id }, i) => (
            <SegmentedControl.Item key={id} value={id} typography="t3" style={styles.item}>
              {labels[i]}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  wrapper: {
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x2,
  },
  // WHY: x1 rather than the item's x2, so the fallback track stays near the 32pt native control it stands in for on iOS 26.
  item: {
    paddingVertical: SdsSpacing.x1,
  },
  native: {
    alignSelf: 'stretch',
  },
}));
