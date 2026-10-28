/**
 * WHY: glass on iOS 26 so it reads as one control set with the campus toggle beside it. No count badge: a
 * chip narrowing is already named by the strip that replaces the chip row.
 */

import { View } from 'react-native';
import { StackSimpleIcon } from 'phosphor-react-native';
import { SdsShadows, useT } from '@skkuverse/shared';
import { GlassSurface, GLASS_AVAILABLE, Pressable, glassFloatShadow, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { MAP_CONTROL_HEIGHT } from '../../map-layout.constants';

interface FilterButtonProps {
  onPress: () => void;
}

export function FilterButton({ onPress }: FilterButtonProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const body = (
    <Pressable
      feedback={GLASS_AVAILABLE ? 'none' : 'scale'}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityLabel={t('filter.layer')}
      onPress={onPress}
    >
      <StackSimpleIcon size={20} color={color.fg.neutralMuted} />
    </Pressable>
  );

  if (GLASS_AVAILABLE) {
    return (
      <View style={[styles.outer, glassFloatShadow]}>
        <GlassSurface interactive style={styles.glassSurface}>
          {body}
        </GlassSurface>
      </View>
    );
  }
  return <View style={[styles.outer, styles.fallback]}>{body}</View>;
}

const SIZE = MAP_CONTROL_HEIGHT;

const useStyles = createThemedStyles(({ color }) => ({
  outer: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  glassSurface: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
  fallback: {
    backgroundColor: color.bg.layerDefault,
    ...SdsShadows.level2.legacy,
  },
  pressable: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
