/**
 * QUIRK(naver-map): `isShowCompass` has no placement control, and this compass sits above the locate button
 * and rides the sheet. A shared value turns the needle on the UI thread without re-rendering the map.
 */

import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { GlassSurface, Pressable, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { MAP_CONTROL_HEIGHT } from '../map-layout.constants';

interface MapCompassProps {
  bearing: SharedValue<number>;
  onPress: () => void;
  label: string;
}

export function MapCompass({ bearing, onPress, label }: MapCompassProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  // WHY: negated: `bearing` is where the camera looks, so the needle turns the other way to keep north.
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-bearing.value}deg` }],
  }));

  return (
    <GlassSurface style={styles.surface}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pressable}
      >
        <Animated.View style={[styles.needle, needleStyle]}>
          <Svg width={22} height={22} viewBox="0 0 22 22">
            {/* WHY: two half-needles sharing a waist, so the north half is red and the south grey with no seam. */}
            <Polygon points="11,1 15,11 11,11 7,11" fill={color.fg.critical} />
            <Polygon points="11,21 15,11 11,11 7,11" fill={color.fg.placeholder} />
          </Svg>
        </Animated.View>
        {/* WHY: outside the rotating view, so the letter stays upright as the map turns. */}
        {/* eslint-disable-next-line sds/no-rn-text -- the housing's N mark, sized to the 22pt needle: a mark, not text on the type scale */}
        <Text style={styles.north}>N</Text>
      </Pressable>
    </GlassSurface>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  surface: {
    width: MAP_CONTROL_HEIGHT,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needle: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  north: {
    position: 'absolute',
    top: 2,
    // eslint-disable-next-line sds/no-type-size-literal -- a mark sized to the needle; see the comment above
    fontSize: 8,
    // eslint-disable-next-line sds/no-font-weight-literal -- a mark sized to the needle; see the comment above
    fontWeight: '700',
    color: color.fg.neutralSubtle,
  },
}));
