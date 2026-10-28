import type { TranslationKey } from '@skkuverse/shared';
import type { UserProfile } from '@/features/profile/profile.rules';
import { emailPrefixOf, isBetter, type BoardEntry, type MyLine, type ScoreOrder } from '../../leaderboard.rules';
import type { GameOver, Submission } from '../host.rules';

export interface PlacedEntry {
  entry: BoardEntry;
  rank: number;
}

interface ResultStanding {
  over: GameOver | null;
  submission: Submission;
  before: PlacedEntry | null;
  myBest: PlacedEntry | null;
  order: ScoreOrder;
  ranked: boolean;
}

export interface ToResultLineInputs extends ResultStanding {
  promoted: boolean;
  predictedRank: number | null;
  uid: string | null;
  profile: UserProfile | null;
  email: string | null;
}

function isBeatingBest({ over, submission, before, order }: ResultStanding): boolean {
  const pending = submission.status === 'idle' || submission.status === 'submitting';
  return !!over && !!before && pending && isBetter(order, over.score, before.entry.score);
}

function isGhost({ over, submission, myBest, ranked }: ResultStanding): boolean {
  return ranked && !!over && submission.status !== 'submitted' && !myBest && over.score > 0;
}

export function toPredictedScore(standing: ResultStanding): number | null {
  return standing.over && (isGhost(standing) || isBeatingBest(standing)) ? standing.over.score : null;
}

export function toResultLine(input: ToResultLineInputs): MyLine | null {
  const { over, submission, before, myBest, promoted, predictedRank, uid, profile } = input;
  if (!over) return null;
  const was: MyLine | null = before && { kind: 'entry', entry: before.entry, rank: before.rank };
  if (!promoted) return was;
  const prefix = emailPrefixOf(input.email);
  const fresh = (rank: number): MyLine | null =>
    uid && profile?.nickname && prefix
      ? { kind: 'entry', entry: { uid, nickname: profile.nickname, emailPrefix: prefix, campus: profile.campus, score: over.score }, rank }
      : null;
  if (submission.status === 'submitted') return fresh(submission.rank ?? predictedRank ?? before?.rank ?? 1) ?? was;
  if (isBeatingBest(input) && predictedRank) return fresh(predictedRank) ?? was;
  if (myBest) return { kind: 'entry', entry: myBest.entry, rank: myBest.rank };
  if (isGhost(input) && predictedRank) return { kind: 'ghost', uid: uid ?? 'me', score: over.score, rank: predictedRank };
  return null;
}

export function toResultNote(
  input: ToResultLineInputs,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string | null {
  const { submission, before, promoted } = input;
  const now = submission.status === 'submitted' ? submission.rank : isBeatingBest(input) ? input.predictedRank : undefined;
  if (now !== undefined) {
    if (!promoted) return null;
    if (!before) return t('game.newEntry');
    if (now !== null && now < before.rank) return tpl('game.rankUp', before.rank - now);
    return null;
  }
  if (submission.status === 'failed' && submission.reason === 'otherAccount') return t('game.submitOtherAccount');
  return null;
}
