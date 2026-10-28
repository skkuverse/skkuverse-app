import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResultSection, Skeleton } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import type { GameId } from '../games.constants';
import { FIRST_PARTY_GAMES } from '../registry.rules';
import { boardLines, type MyLine } from '../leaderboard.rules';
import { BoardHeader } from './BoardHeader';
import { openLeaderboard } from '../games.service';
import { LeaderboardList } from './LeaderboardList';
import { useBoardTop } from '../useBoardTop';
import { useMyBest } from '../useMyBest';
import { useBoardViewer } from './useBoardViewer';

interface Props {
  gameId: GameId;
  limit?: number;
  /**
   * WHY: left out, it is the signed-in player's best on the board; the result screen passes a ghost or the entry it
   * just wrote.
   */
  me?: MyLine | null;
  footer?: ReactNode;
  showHeader?: boolean;
  /** WHY: home shows the player's line right under the top with no gap row, and reads nothing on a remount. */
  compact?: boolean;
  /** WHY: keeps a line's room even when this game has no player's line, so every carousel page is the same height. */
  reserveMine?: boolean;
}

/** WHY: always N places, the unheld ones blank. */
export function LeaderboardTopSection({
  gameId,
  limit = 5,
  me,
  footer,
  showHeader = true,
  compact = false,
  reserveMine = false,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const { uid, isAnonymous } = useBoardViewer();
  const reads = compact ? { refetchOnMount: false } : {};
  const top = useBoardTop(gameId, limit, reads);
  const myBest = useMyBest(gameId, me === undefined && uid && !isAnonymous ? uid : null, reads);
  const { order, format } = FIRST_PARTY_GAMES[gameId].score;

  const mine: MyLine | null = useMemo(() => {
    if (me !== undefined) return me;
    if (!myBest.data) return null;
    return { kind: 'entry', entry: myBest.data.entry, rank: myBest.data.rank };
  }, [me, myBest.data]);

  // WHY: nothing until the top is in, or the player's line placed against an empty list reads as first. Not
  // signed in at all, nothing can be read, so the places draw empty rather than loading for ever.
  const lines = useMemo(() => {
    const all = top.data
      ? boardLines({ top: top.data, order, limit, me: mine, fill: true })
      : uid === null
        ? boardLines({ top: [], order, limit, me: null, fill: true })
        : [];
    return compact ? all.filter((line) => line.kind !== 'gap') : all;
  }, [top.data, order, limit, mine, uid, compact]);
  const compactRows = limit + (reserveMine ? 1 : 0);

  return (
    <View style={styles.section}>
      {showHeader && <BoardHeader typography="t7" onViewAll={() => openLeaderboard(router, gameId, 'game')} />}
      {top.isError ? (
        <ResultSection
          size="medium"
          description={t('game.leaderboardError')}
          primaryActionProps={{ children: t('common.retry'), onPress: () => void top.refetch() }}
          // WHY: keeps the rows' room, so the card does not shrink on a failed page.
          style={compact ? { minHeight: ROW_HEIGHT * compactRows } : undefined}
        />
      ) : lines.length === 0 ? (
        <Skeleton.Animate>
          <View style={styles.skeleton}>
            {/* WHY: as tall as the rows that replace it, so the card does not jump. */}
            {Array.from({ length: compact ? compactRows : Math.min(limit, 3) }, (_, i) => (
              <Skeleton key={i} height={ROW_HEIGHT - SKELETON_GAP} borderRadius={SdsRadius.r3} />
            ))}
          </View>
        </Skeleton.Animate>
      ) : (
        <>
          <LeaderboardList lines={lines} format={format} />
          {compact && lines.length < compactRows && <View style={{ height: ROW_HEIGHT * (compactRows - lines.length) }} />}
        </>
      )}
      {footer}
    </View>
  );
}

/** WHY: LeaderboardRow's minimum height. */
const ROW_HEIGHT = 52;
const SKELETON_GAP = 8;

const styles = StyleSheet.create({
  section: { gap: SdsSpacing.x1 },
  skeleton: { gap: SKELETON_GAP, paddingVertical: SKELETON_GAP / 2 },
});
