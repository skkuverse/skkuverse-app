import { Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { SdsSpacing } from '@skkuverse/shared';
import { SegmentedControl, createThemedStyles } from '@skkuverse/sds';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

// WHY: native UISegmentedControl on iOS 26+, SDS `SegmentedControl` elsewhere, as the schedule screen draws it.
export function Toggle<T extends string>({
  values,
  labels,
  selectedIndex,
  onSelect,
}: {
  values: T[];
  labels: string[];
  selectedIndex: number;
  onSelect: (value: T) => void;
}) {
  const styles = useStyles();
  if (Platform.OS === 'ios' && GLASS_AVAILABLE) {
    return (
      <NativeSegmentedControl
        values={labels}
        selectedIndex={selectedIndex}
        onChange={(e) => {
          const value = values[e.nativeEvent.selectedSegmentIndex];
          if (value !== undefined) onSelect(value);
        }}
        style={styles.nativeSegmented}
      />
    );
  }
  return (
    <SegmentedControl
      value={values[selectedIndex]}
      onValueChange={(value) => onSelect(value as T)}
    >
      {values.map((value, i) => (
        <SegmentedControl.Item key={value} value={value} typography="t3" style={toggleItemStyle}>
          {labels[i]}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}

const toggleItemStyle = { paddingVertical: SdsSpacing.x1 } as const;

const useStyles = createThemedStyles(() => ({
  nativeSegmented: {
    alignSelf: 'stretch',
  },
}));
