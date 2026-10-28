import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_AUTO_ROTATE_SEC, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { LoopingPager } from '@/components/LoopingPager';
import type { GameId } from '../games.constants';
import { FIRST_PARTY_GAMES } from '../registry.rules';
import { logHomeContentSelect } from '@/platform/analytics';
import { BoardHeader } from '../components/BoardHeader';
import { openLeaderboard } from '../games.service';
import { GameChip } from './components/GameChip';
import { LeaderboardTopSection } from '../components/LeaderboardTopSection';
import { useMyBests } from '../useMyBest';
import { useHomeHallOfFame } from './useHomeHallOfFame';
import { createThemedStyles } from '@skkuverse/sds';

const HOME_LIMIT = 3;
const SECTION_MARGIN = 16;
const CARD_PADDING = 8;

/** WHY: a game without a board has no page. */
export function HomeHallOfFame({ gameIds: placed }: { gameIds: readonly GameId[] }) {
  const gameIds = useMemo(() => placed.filter((id) => FIRST_PARTY_GAMES[id].leaderboard), [placed]);
  const styles = useStyles();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const pageKey = gameIds.join('|');
  // WHY: every page leaves room for the player's line once any game has one, so the carousel keeps one height as it
  // turns.
  const { uid, isAnonymous } = useHomeHallOfFame();
  const bests = useMyBests(gameIds, uid && !isAnonymous ? uid : null, { refetchOnMount: false });
  const reserveMine = bests.some((q) => (q.data?.rank ?? 0) > HOME_LIMIT);

  const renderPage = useCallback(
    (i: number) => {
      const id = gameIds[i]!;
      return (
        <View style={styles.page}>
          <View style={styles.chip}>
            <GameChip gameId={id} />
          </View>
          <LeaderboardTopSection gameId={id} limit={HOME_LIMIT} showHeader={false} compact reserveMine={reserveMine} />
        </View>
      );
    },
    [gameIds, reserveMine, styles],
  );

  if (gameIds.length === 0) return null;
  const current = gameIds[page % gameIds.length]!;
  return (
    <View style={styles.section}>
      <BoardHeader typography="t9" onViewAll={() => {
          logHomeContentSelect({ content_type: 'hall_of_fame', item_id: current });
          openLeaderboard(router, current, 'hall_of_fame');
        }} />
      <View style={styles.card}>
        <LoopingPager
          pageCount={gameIds.length}
          pageKey={pageKey}
          autoRotateMs={DEFAULT_AUTO_ROTATE_SEC * 1000}
          renderPage={renderPage}
          onPageChange={setPage}
          counter="topRight"
        />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  section: { marginHorizontal: SECTION_MARGIN, marginBottom: SdsSpacing.x9, gap: SdsSpacing.x2 },
  // WHY: the padding is on each page, not the card, so pages slide to the card's edge.
  card: { backgroundColor: color.bg.layerDefault, borderRadius: SdsRadius.r4, overflow: 'hidden' },
  page: { padding: CARD_PADDING, paddingTop: CARD_PADDING + 2 },
  chip: { paddingHorizontal: SdsSpacing.x2_5, paddingTop: SdsSpacing.x1_5, paddingBottom: SdsSpacing.x2_5 },
}));
