/**
 * QUIRK(ios): UITabAccessory forces its Liquid Glass full width and wires no keyboard avoidance, so there is no
 * own GlassView and search pushes a route. Both placements mount at once, so state lives in notices.store.
 */

import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { useNoticesSearchPlaceholder } from './useNoticesSearchPlaceholder';
import { logNoticesContentSelect } from '@/platform/analytics';
import { Pressable, useSemanticColors, createThemedStyles, Txt } from '@skkuverse/sds';

const ICON_SIZE = 20;

export function NoticesAccessoryBar() {
  const styles = useStyles();
  const color = useSemanticColors();
  const router = useRouter();
  const placeholder = useNoticesSearchPlaceholder();
  return (
    <Pressable
      onPress={() => {
        logNoticesContentSelect({ content_type: 'accessory_search', item_id: 'pill' });
        router.push('/notices/search');
      }}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
    >
      <View style={styles.inner} pointerEvents="none">
        <View style={styles.iconLeft}>
          <MagnifyingGlassIcon size={ICON_SIZE} color={color.fg.neutralMuted} />
        </View>
        <Txt typography="t5" fontWeight="medium" style={styles.label}>{placeholder}</Txt>
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // WHY: the inner box clamps the icon and label, so on iPad the icon does not drift to the screen edge.
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  label: {
    color: color.fg.neutral,
  },
}));
