/**
 * WHY: the first row always says what the map is showing (ADR 0022 d1). No close mark here: the one on
 * screen is the sheet's. At the toolbar's height, so the row does not change height.
 */

import { View } from 'react-native';
import { MagnifyingGlassIcon } from 'phosphor-react-native';
import { SdsRadius, SdsShadows, SdsSpacing } from '@skkuverse/shared';
import { GLASS_AVAILABLE, GlassSurface, Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { MAP_TOOLBAR_HEIGHT } from '../../map-layout.constants';

interface TaskFieldProps {
  title: string;
  onPress: () => void;
  label: string;
  glass: boolean;
}

export function TaskField({ title, onPress, label, glass }: TaskFieldProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const onGlass = GLASS_AVAILABLE && glass;
  const field = (
    <Pressable
      bg={onGlass ? undefined : 'layerDefault'}
      feedback={onGlass ? 'none' : 'color'}
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={label}
      accessibilityValue={{ text: title }}
      style={styles.field}
    >
      <MagnifyingGlassIcon size={20} color={color.fg.neutralMuted} />
      <Txt typography="t6" fontWeight="semibold" color="neutral" numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
    </Pressable>
  );
  return onGlass ? (
    <GlassSurface interactive style={styles.pill}>
      {field}
    </GlassSurface>
  ) : (
    <View style={[styles.pill, styles.pillSolid]}>{field}</View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  pill: {
    flex: 1,
    height: MAP_TOOLBAR_HEIGHT,
    borderRadius: SdsRadius.full,
    // WHY: load-bearing on the glass path: the effect bleeds past the corners without it.
    overflow: 'hidden',
  },
  pillSolid: {
    backgroundColor: color.bg.layerDefault,
    ...SdsShadows.level2.legacy,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    paddingHorizontal: SdsSpacing.x4,
  },
  title: {
    flex: 1,
  },
}));
