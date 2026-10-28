/**
 * WHY: the search entry where there is no bottom accessory (before iOS 26, Android); mounted in the tab's
 * body branch, so it never leaks to other tabs, the search route or the onboarding gate.
 */

import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { useNoticesSearchPlaceholder } from '../useNoticesSearchPlaceholder';
import { SdsShadows } from '@skkuverse/shared';
import { Pressable, useSemanticColors, createThemedStyles, Txt } from '@skkuverse/sds';

const ICON_SIZE = 20;
const CAPSULE_HEIGHT = 52;
const HORIZONTAL_INSET = 16;
// QUIRK(react-navigation): the bottom-tabs bar is static in the layout flow, so an absolute `bottom: 0`
// already sits on its top edge; adding its height double-counts and floats the capsule about 80pt high.
const BOTTOM_GAP = 8;

export function NoticesSearchFallbackBar() {
  const styles = useStyles();
  const color = useSemanticColors();
  const router = useRouter();
  const placeholder = useNoticesSearchPlaceholder();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: BOTTOM_GAP }]}>
      <Pressable
        onPress={() => router.push('/notices/search')}
        bg="layerFloating"
        style={styles.capsule}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
      >
        <View style={styles.iconLeft} pointerEvents="none">
          <MagnifyingGlassIcon size={ICON_SIZE} color={color.fg.neutralMuted} />
        </View>
        <Txt typography="t5" fontWeight="medium" style={styles.label}>{placeholder}</Txt>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  wrap: {
    position: 'absolute',
    left: HORIZONTAL_INSET,
    right: HORIZONTAL_INSET,
  },
  capsule: {
    height: CAPSULE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CAPSULE_HEIGHT / 2,
    ...SdsShadows.level3.legacy,
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
