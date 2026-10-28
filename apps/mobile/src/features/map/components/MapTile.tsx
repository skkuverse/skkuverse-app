/**
 * WHY: the ring is drawn on an always-present wrapper that changes colour, never width, so a tap never reflows
 * the grid.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SdsRadius, SdsShadows, SdsSpacing } from '@skkuverse/shared';
import { MapThumb } from './MapThumb';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';

interface MapTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  badge?: ReactNode;
}

export function MapTile({ label, selected, onPress, badge }: MapTileProps) {
  const styles = useStyles();
  return (
    // WHY: the ring shows the selection, so a press only shrinks the tile (PRESS-06).
    <Pressable
      feedback="scale"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.tile}
    >
      <View style={[styles.ring, selected && styles.ringSelected]}>
        <View style={styles.thumb}>
          <MapThumb />
          {badge ? (
            // WHY: an absolute overlay: in flow it would start below the full-height SVG and be clipped.
            <View style={styles.badgeLayer} pointerEvents="none">
              <View style={styles.badge}>{badge}</View>
            </View>
          ) : null}
        </View>
      </View>
      <Txt
        typography="t3"
        fontWeight={selected ? 'bold' : 'semibold'}
        color={selected ? 'brand' : 'neutralMuted'}
        textAlign="center"
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

const BADGE_SHADOW = { boxShadow: SdsShadows.level1.boxShadow, ...SdsShadows.level1.legacy } as const;

const useStyles = createThemedStyles(({ color }) => ({
  tile: {
    alignItems: 'center',
  },
  ring: {
    width: '100%',
    borderWidth: 2.5,
    // WHY: transparent rather than absent, so selecting cannot change the layout.
    borderColor: 'transparent',
    // eslint-disable-next-line sds/no-radius-literal -- concentric with the thumbnail: its 13 + the 2.5 gap + the 2.5 ring; no pair of steps keeps the ring's width even
    borderRadius: 18,
    // eslint-disable-next-line sds/no-spacing-literal -- the gap between the ring and the thumbnail, matched to the ring's 2.5 width
    padding: 2.5,
  },
  ringSelected: {
    borderColor: color.stroke.brandSolid,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    // eslint-disable-next-line sds/no-radius-literal -- the ring's 18 less its 2.5 width and 2.5 gap, so the two corners stay concentric
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.neutralWeak,
  },
  badgeLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.layerDefault,
    alignItems: 'center',
    justifyContent: 'center',
    // WHY: a border at this size would read as a second ring competing with the selection.
    ...BADGE_SHADOW,
  },
  label: {
    marginTop: SdsSpacing.x2,
  },
}));
