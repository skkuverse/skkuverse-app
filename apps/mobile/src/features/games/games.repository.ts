import {
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit as limitTo,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import type { GameId } from './games.constants';
import { rankFromCount, type BoardEntry, type ScoreOrder } from './leaderboard.rules';

/** WHY: read only; an entry is written by the `submitScore` callable, never by this app. */
const scores = (gameId: GameId) => collection(getFirestore(), 'leaderboards', gameId, 'scores');

function toBoardEntry(d: Record<string, unknown> | undefined, uid: string): BoardEntry | null {
  if (!d || typeof d.score !== 'number' || typeof d.nickname !== 'string') return null;
  return {
    uid,
    nickname: d.nickname,
    emailPrefix: typeof d.emailPrefix === 'string' ? d.emailPrefix : '',
    campus: d.campus === 'nsc' ? 'nsc' : 'hssc',
    score: d.score,
  };
}

export async function topEntries(gameId: GameId, order: ScoreOrder, limit: number): Promise<BoardEntry[]> {
  const snap = await getDocs(query(scores(gameId), orderBy('score', order), limitTo(limit)));
  return snap.docs.map((d) => toBoardEntry(d.data(), d.id)).filter((e): e is BoardEntry => e !== null);
}

/** WHY: from the server, since a cached copy could be an older best. */
export async function myEntry(gameId: GameId, uid: string): Promise<BoardEntry | null> {
  const snap = await getDocFromServer(doc(scores(gameId), uid));
  return toBoardEntry(snap.data(), uid);
}

export async function rankOf(gameId: GameId, order: ScoreOrder, score: number): Promise<number> {
  const snap = await getCountFromServer(query(scores(gameId), where('score', order === 'desc' ? '>' : '<', score)));
  return rankFromCount(snap.data().count);
}
