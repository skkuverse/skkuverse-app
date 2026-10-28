import { useMemo, type Ref } from 'react';
import {
  View,
  Image,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Pressable, Tossface, createThemedStyles, Txt } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

export interface TossfaceGridItem {
  id: string;
  title: string;
  emoji?: string;
  imageSource?: ImageSourcePropType;
  onPress: () => void;
  isNew?: boolean;
  viewRef?: Ref<View>;
}

interface Props {
  items: readonly TossfaceGridItem[];
}

const GRID_PADDING = 16;
const GRID_GAP = 8;
const GRID_COLS = 4;
const PHONE_MAX_WIDTH = 480;

export function tossfaceGridMetrics(screenW: number): {
  containerWidth: number;
  innerWidth: number;
  itemSize: number;
  gap: number;
} {
  const w = Math.min(screenW, PHONE_MAX_WIDTH);
  const inner = w - GRID_PADDING * 2;
  const size = (inner - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
  return { containerWidth: w, innerWidth: inner, itemSize: size, gap: GRID_GAP };
}

export function TossfaceButtonGrid({ items }: Props) {
  const styles = useStyles();
  const { width: screenW } = useWindowDimensions();
  const { containerWidth, itemSize } = useMemo(() => tossfaceGridMetrics(screenW), [screenW]);

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          ref={item.viewRef}
          bg="layerDefault"
          style={[styles.button, { width: itemSize, height: itemSize }]}
          onPress={item.onPress}
        >
          {item.imageSource ? (
            <Image
              source={item.imageSource}
              style={styles.tileImage}
              resizeMode="contain"
            />
          ) : (
            <Tossface size={26} style={styles.emoji}>{item.emoji}</Tossface>
          )}
          <Txt typography="t2" fontWeight="medium" style={styles.title} numberOfLines={1}>
            {item.title}
          </Txt>
          {item.isNew ? (
            <View style={styles.newBadge}>
              <Txt typography="t1" fontWeight="bold" color="onCriticalSolid">
                N
              </Txt>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
    alignSelf: 'center',
  },
  button: {
    borderRadius: SdsRadius.r4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x2,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
  },
  emoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box, sized to the tile's slot; an emoji is not on the type scale
    lineHeight: 32,
  },
  tileImage: {
    width: 44,
    height: 44,
    borderRadius: SdsRadius.r2_5,
  },
  title: {
    color: color.fg.neutral,
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.criticalSolid,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.x1,
  },
}));
