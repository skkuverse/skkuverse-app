import { describe, expect, test } from 'vitest';
import type { TranslationKey } from '@skkuverse/shared';
import type { BoardEntry } from '../../leaderboard.rules';
import type { GameOver } from '../host.rules';
import { toPredictedScore, toResultLine, toResultNote, type PlacedEntry, type ToResultLineInputs } from './result-line.rules';

const e = (uid: string, score: number): BoardEntry => ({ uid, nickname: uid, emailPrefix: uid.slice(0, 3), campus: 'hssc', score });
const over = (score: number): GameOver => ({ score, ticks: 100, hit: null, revives: 0, revivesLeft: 0 });
const best: PlacedEntry = { entry: e('u1', 300), rank: 8 };

/** A signed-in player with a nickname, whose best (300, 8th) stood before this crash, which scored 420 and is unsettled. */
const input = (o: Partial<ToResultLineInputs> = {}): ToResultLineInputs => ({
  over: over(420),
  submission: { status: 'idle' },
  before: best,
  myBest: best,
  order: 'desc',
  ranked: true,
  promoted: true,
  predictedRank: 3,
  uid: 'u1',
  profile: { campus: 'nsc', nickname: '파도왕' },
  email: 'wave@g.skku.edu',
  ...o,
});
const fresh = (score: number, rank: number) => ({
  kind: 'entry',
  entry: { uid: 'u1', nickname: '파도왕', emailPrefix: 'wav', campus: 'nsc', score },
  rank,
});
const t = (key: TranslationKey) => key;
const tpl = (key: TranslationKey, ...args: (string | number)[]) => `${key}:${args.join(',')}`;
const note = (o: Partial<ToResultLineInputs>) => toResultNote(input(o), t, tpl);

describe('toResultLine', () => {
  test('no result on screen, no line', () => {
    expect(toResultLine(input({ over: null }))).toBe(null);
  });

  test('the panel opens on the old place, or none, until the line is promoted', () => {
    expect(toResultLine(input({ promoted: false }))).toStrictEqual({ kind: 'entry', entry: best.entry, rank: 8 });
    expect(toResultLine(input({ promoted: false, before: null }))).toBe(null);
  });

  test('a new best still pending climbs to the predicted rank, with the result as the score', () => {
    expect(toResultLine(input())).toStrictEqual(fresh(420, 3));
    expect(toResultLine(input({ submission: { status: 'submitting' } }))).toStrictEqual(fresh(420, 3));
  });

  test('until the predicted rank is in, a pending new best shows the best as it stands', () => {
    expect(toResultLine(input({ predictedRank: null }))).toStrictEqual({ kind: 'entry', entry: best.entry, rank: 8 });
  });

  test('a written result takes the rank the server counted, falling back to the prediction, the old place, then 1st', () => {
    expect(toResultLine(input({ submission: { status: 'submitted', rank: 2 } }))).toStrictEqual(fresh(420, 2));
    expect(toResultLine(input({ submission: { status: 'submitted', rank: null } }))).toStrictEqual(fresh(420, 3));
    expect(toResultLine(input({ submission: { status: 'submitted', rank: null }, predictedRank: null }))).toStrictEqual(fresh(420, 8));
    expect(toResultLine(input({ submission: { status: 'submitted', rank: null }, predictedRank: null, before: null }))).toStrictEqual(fresh(420, 1));
  });

  test('a line that cannot be written (no nickname, no usable email) stays on the old place', () => {
    const was = { kind: 'entry', entry: best.entry, rank: 8 };
    expect(toResultLine(input({ profile: { campus: 'nsc', nickname: null } }))).toStrictEqual(was);
    expect(toResultLine(input({ email: '_x@g.skku.edu' }))).toStrictEqual(was);
    expect(toResultLine(input({ submission: { status: 'submitted', rank: 2 }, profile: null }))).toStrictEqual(was);
  });

  test('a result that is not a new best leaves the best on the line', () => {
    expect(toResultLine(input({ over: over(200) }))).toStrictEqual({ kind: 'entry', entry: best.entry, rank: 8 });
    expect(toResultLine(input({ submission: { status: 'notImproved' } }))).toStrictEqual({ kind: 'entry', entry: best.entry, rank: 8 });
  });

  test('a time board: less is better, so a faster run climbs', () => {
    const time = { entry: e('u1', 9000), rank: 5 };
    expect(toResultLine(input({ order: 'asc', before: time, myBest: time, over: over(8000) }))).toStrictEqual(fresh(8000, 3));
    expect(toResultLine(input({ order: 'asc', before: time, myBest: time, over: over(9500) }))).toStrictEqual({
      kind: 'entry',
      entry: time.entry,
      rank: 5,
    });
  });

  test('a first result is a ghost at the predicted rank, under the uid, or "me" when signed out', () => {
    const first = { before: null, myBest: null };
    expect(toResultLine(input(first))).toStrictEqual({ kind: 'ghost', uid: 'u1', score: 420, rank: 3 });
    expect(toResultLine(input({ ...first, uid: null }))).toStrictEqual({ kind: 'ghost', uid: 'me', score: 420, rank: 3 });
  });

  test('no ghost without a rank, without a board, or for a score of 0', () => {
    const first = { before: null, myBest: null };
    expect(toResultLine(input({ ...first, predictedRank: null }))).toBe(null);
    expect(toResultLine(input({ ...first, ranked: false }))).toBe(null);
    expect(toResultLine(input({ ...first, over: over(0) }))).toBe(null);
  });
});

describe('toPredictedScore', () => {
  test('a rank is counted for a pending new best and for a first result', () => {
    expect(toPredictedScore(input())).toBe(420);
    expect(toPredictedScore(input({ before: null, myBest: null }))).toBe(420);
  });

  test('none once the result is written or settled, for a result that is not a best, or with no board', () => {
    expect(toPredictedScore(input({ submission: { status: 'submitted', rank: 2 } }))).toBe(null);
    expect(toPredictedScore(input({ submission: { status: 'failed', reason: 'network' } }))).toBe(null);
    expect(toPredictedScore(input({ over: over(200) }))).toBe(null);
    expect(toPredictedScore(input({ before: null, myBest: null, ranked: false }))).toBe(null);
    expect(toPredictedScore(input({ before: null, myBest: null, over: over(0) }))).toBe(null);
    expect(toPredictedScore(input({ over: null }))).toBe(null);
  });
});

describe('toResultNote', () => {
  test('a climb says by how many places, once the line has moved', () => {
    expect(note({})).toBe('game.rankUp:5');
    expect(note({ submission: { status: 'submitted', rank: 6 } })).toBe('game.rankUp:2');
    expect(note({ promoted: false })).toBe(null);
  });

  test('a first entry on the board says so', () => {
    expect(note({ before: null, submission: { status: 'submitted', rank: 4 } })).toBe('game.newEntry');
  });

  test('no note when the place does not improve or is not known yet', () => {
    expect(note({ submission: { status: 'submitted', rank: 8 } })).toBe(null);
    expect(note({ submission: { status: 'submitted', rank: null } })).toBe(null);
    expect(note({ predictedRank: null })).toBe(null);
    expect(note({ over: over(200) })).toBe(null);
  });

  test('a run stamped under another account says so', () => {
    expect(note({ submission: { status: 'failed', reason: 'otherAccount' } })).toBe('game.submitOtherAccount');
    expect(note({ submission: { status: 'failed', reason: 'rejected' } })).toBe(null);
  });
});
