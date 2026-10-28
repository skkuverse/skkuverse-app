/**
 * WHY: sized from the parent, never the window. The card's inset animates as the sheet rises, so a window
 * width overflows it at every detent; `flex: 1` tiles and `aspectRatio` need no measurement.
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { Pressable, Tossface, createThemedStyles, Txt } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { handleSduiAction } from '@/features/web/web.service';
import { logSduiContentSelect } from '@/platform/analytics';
import type { SduiButtonGrid as ButtonGridType } from '@/features/map/campus-sheet/campus-sheet.types';

interface Props {
  section: ButtonGridType;
}

const GRID_GAP = 8;

/** WHY: a cap, not a width, so tiles stop growing on a tablet while the grid still takes less when given less. */
const GRID_MAX_WIDTH = 480;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function ButtonGrid({ section }: Props) {
  const styles = useStyles();
  const columns = Math.max(1, section.columns);
  const rows = useMemo(() => chunk(section.items, columns), [section.items, columns]);

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={row[0]?.id ?? rowIndex} style={styles.row}>
          {row.map((item) => (
            <Pressable
              key={item.id}
              bg="neutralMuted"
              style={styles.button}
              onPress={() => {
                logSduiContentSelect({ content_type: 'button_grid_item', item_id: item.id });
                handleSduiAction({
                  actionType: item.actionType,
                  actionValue: item.actionValue,
                  webviewTitle: item.webviewTitle,
                  webviewColor: item.webviewColor,
                  source: 'sdui',
                });
              }}
            >
              <Tossface size={26} style={styles.emoji}>{item.emoji}</Tossface>
              <Txt typography="t2" fontWeight="medium" style={styles.title} numberOfLines={1}>
                {item.title}
              </Txt>
            </Pressable>
          ))}
          {/* WHY: a short final row keeps a full row's column width, or three items stretch across four columns. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`filler-${i}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    width: '100%',
    maxWidth: GRID_MAX_WIDTH,
    alignSelf: 'center',
    gap: GRID_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  button: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: SdsRadius.r4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x2,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
    overflow: 'hidden',
  },
  filler: {
    flex: 1,
  },
  emoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box in the tile; an emoji is not on the type scale
    lineHeight: 32,
  },
  title: {
    color: color.fg.neutral,
  },
}));
