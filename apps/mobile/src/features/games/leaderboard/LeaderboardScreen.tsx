import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowClockwiseIcon, XIcon } from 'phosphor-react-native';
import { GLASS_AVAILABLE, GlassCard, IconButton, Loader, Pressable, ResultSection, Txt, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { track, useViewTracking } from '@/platform/analytics';
import type { EntrySource } from '@/platform/analytics.rules';
import type { GameId } from '../games.constants';
import { FIRST_PARTY_GAMES } from '../registry.rules';
import { boardLines, type BoardLine, type MyLine } from '../leaderboard.rules';
import { GameChip } from './components/GameChip';
import { HallOfFameTitle } from '../components/HallOfFameTitle';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { useBoardTop } from '../useBoardTop';
import { useInvalidateLeaderboard } from '../useInvalidateLeaderboard';
import { useMyBest } from '../useMyBest';
import { useLeaderboardScreen } from './useLeaderboardScreen';

const BOARD_SIZE = 10;
/** WHY: clear of a game's floating buttons (40 pt, 8 pt below the inset), as the game's own chrome is. */
const TOP_CLEARANCE = 56;
const MARGIN = 16;
/** WHY: a loading or empty board still reads as a card, not a strip. */
const MIN_CARD_HEIGHT = 260;

export function LeaderboardScreen({ gameId, source }: { gameId: GameId; source: EntrySource }) {
  const color = useSemanticColors();
  useViewTracking('leaderboard', gameId, source);
  const router = useRouter();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { uid, isAnonymous } = useLeaderboardScreen();
  const game = FIRST_PARTY_GAMES[gameId];

  const board = useBoardTop(gameId, BOARD_SIZE);
  const myBest = useMyBest(gameId, uid && !isAnonymous ? uid : null);
  const invalidate = useInvalidateLeaderboard(gameId);
  // WHY: invalidating refetches every view of this board, home included, from the server; one refresh at a time.
  const [refreshing, setRefreshing] = useState<'button' | 'pull' | null>(null);
  const refresh = (from: 'button' | 'pull') => {
    if (refreshing) return;
    track('item_action', { view: 'leaderboard', item_id: gameId, action: 'refresh', target: from });
    setRefreshing(from);
    void invalidate().finally(() => setRefreshing(null));
  };
  const lines = useMemo(() => {
    if (!board.data) return [];
    const me: MyLine | null = myBest.data ? { kind: 'entry', entry: myBest.data.entry, rank: myBest.data.rank } : null;
    return boardLines({ top: board.data, order: game.score.order, limit: BOARD_SIZE, me, fill: true });
  }, [board.data, myBest.data, game.score.order]);

  const close = () => router.back();

  const renderLine = ({ item }: { item: BoardLine }) =>
    item.kind === 'gap' ? (
      <Txt typography="t5" color="placeholder" style={styles.gap}>
        ⋯
      </Txt>
    ) : (
      <LeaderboardRow line={item} format={game.score.format} />
    );

  return (
    <View style={styles.root}>
      {/*
        WHY: lighter over glass, which samples what is behind it (the SDS Sheet's rule); a tap closes with no
        feedback.
      */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_AVAILABLE ? color.bg.overlayMuted : color.bg.overlay }]}>
        <Pressable
          feedback="none"
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.slot, { top: insets.top + TOP_CLEARANCE, bottom: insets.bottom + MARGIN }]}
      >
        <GlassCard style={styles.card} contentStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.titles}>
              <GameChip gameId={gameId} />
              <HallOfFameTitle typography="t9" />
            </View>
            <View style={styles.actions}>
              {refreshing === 'button' ? (
                <View style={styles.spinner}>
                  <Loader size="small" tone="neutral" />
                </View>
              ) : (
                <IconButton
                  icon={<ArrowClockwiseIcon size={22} color={color.fg.neutral} />}
                  onPress={() => refresh('button')}
                  disabled={refreshing !== null}
                  label={t('common.refresh')}
                />
              )}
              <IconButton icon={<XIcon size={22} color={color.fg.neutral} />} onPress={close} label={t('common.close')} />
            </View>
          </View>
          <FlatList
            data={lines}
            keyExtractor={(line) => line.key}
            renderItem={renderLine}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={() => refresh('pull')}
            refreshing={refreshing === 'pull'}
            ListEmptyComponent={
              board.isLoading ? (
                <View style={styles.empty}>
                  <Loader size="medium" tone="neutral" />
                </View>
              ) : board.isError ? (
                <ResultSection
                  size="medium"
                  description={t('game.leaderboardError')}
                  primaryActionProps={{
                    children: t('common.retry'),
                    onPress: () => {
                      track('item_action', { view: 'leaderboard', item_id: gameId, action: 'retry' });
                      void board.refetch();
                    },
                  }}
                  style={styles.emptyResult}
                />
              ) : (
                <ResultSection
                  size="medium"
                  description={t('game.leaderboardEmpty')}
                  style={styles.emptyResult}
                />
              )
            }
          />
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { position: 'absolute', left: MARGIN, right: MARGIN },
  card: { maxHeight: '100%', minHeight: MIN_CARD_HEIGHT },
  content: { flexShrink: 1, paddingTop: SdsSpacing.x4, paddingHorizontal: SdsSpacing.x2, paddingBottom: SdsSpacing.x2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SdsSpacing.x2_5, marginBottom: SdsSpacing.x2 },
  titles: { flex: 1, gap: SdsSpacing.x1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.x1 },
  // WHY: the icon button's own box, so the X does not move while it spins.
  spinner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingBottom: SdsSpacing.x1 },
  gap: { textAlign: 'center', paddingVertical: SdsSpacing.x0_5 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SdsSpacing.x12 },
  // WHY: keeps the height it had, over ResultSection's own padding.
  emptyResult: { paddingVertical: SdsSpacing.x12 },
});
