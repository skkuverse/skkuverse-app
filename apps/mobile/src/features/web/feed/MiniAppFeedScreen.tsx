import { FlatList, RefreshControl, View } from 'react-native';
import { Stack } from 'expo-router';
import { ResultSection, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { FeedRow } from './components/FeedRow';
import { useMiniAppFeed } from './useMiniAppFeed';

/** WHY: where a festival push lands by default, so a banner cut at two lines can be read whole. */
export function MiniAppFeedScreen({ miniAppId }: { miniAppId: string }) {
  const styles = useStyles();
  const { t } = useT();
  const { status, title, rows, refreshing, onRefresh } = useMiniAppFeed(miniAppId);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.entry.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <FeedRow
            entry={item.entry}
            full
            timeText={item.timeText}
            onPress={item.onPress}
          />
        )}
        ListEmptyComponent={
          status === 'loading' ? null : (
            <ResultSection
              size="medium"
              description={status === 'error' ? t('miniappFeed.error') : t('miniappFeed.empty')}
              primaryActionProps={status === 'error' ? { children: t('common.retry'), onPress: onRefresh } : undefined}
              style={styles.empty}
            />
          )
        }
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.neutralMuted,
  },
  content: {
    padding: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x12,
  },
  separator: {
    height: 8,
  },
  // WHY: the empty state starts where the feed's first card would, not centred on the screen.
  empty: {
    flexGrow: 0,
    paddingTop: SdsSpacing.x16,
  },
}));
