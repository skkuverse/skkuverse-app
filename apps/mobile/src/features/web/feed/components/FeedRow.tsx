import { View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { ListRow, Txt, createThemedStyles } from '@skkuverse/sds';
import type { MiniAppFeedEntry } from '../../web.types';

export function FeedRow({
  entry,
  timeText,
  full,
  onPress,
}: {
  entry: MiniAppFeedEntry;
  timeText: string;
  full?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <ListRow
      onPress={onPress}
      style={styles.row}
      containerStyle={styles.container}
      contents={
        <View>
          <View style={styles.titleLine}>
            <Txt
              typography="t4"
              fontWeight="semiBold"
              color="neutral"
              numberOfLines={full ? undefined : 1}
              style={styles.titleText}
            >
              {entry.title}
            </Txt>
            <Txt typography="t2" color="neutralSubtle" style={styles.time}>
              {timeText}
            </Txt>
          </View>
          <Txt
            typography="t4"
            color={full ? 'neutralMuted' : 'neutralSubtle'}
            numberOfLines={full ? undefined : 1}
            lineBreakStrategyIOS="standard"
            textBreakStrategy="balanced"
          >
            {entry.body}
          </Txt>
        </View>
      }
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    backgroundColor: color.bg.layerDefault,
    borderRadius: SdsRadius.r4,
    overflow: 'hidden',
  },
  container: {
    paddingVertical: SdsSpacing.x3_5,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SdsSpacing.x2,
  },
  titleText: {
    flex: 1,
  },
  time: {
    flexShrink: 0,
  },
}));
