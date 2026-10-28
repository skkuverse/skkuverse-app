/** WHY: one entry per player per game (`leaderboards/{gameId}/scores/{uid}`, their best); pure, type-only imports. */
import type { Campus } from '@skkuverse/shared';

export interface BoardEntry {
  uid: string;
  nickname: string;
  emailPrefix: string;
  campus: Campus;
  score: number;
}

/**
 * WHY: every comparison of two scores goes through `isBetter`, never a bare `>`, and the board is read in this
 * order.
 */
export type ScoreOrder = 'asc' | 'desc';

export function isBetter(order: ScoreOrder, a: number, b: number): boolean {
  return order === 'asc' ? a < b : a > b;
}

export function rankWithTies(scores: readonly number[]): number[] {
  const out: number[] = [];
  scores.forEach((s, i) => out.push(i > 0 && scores[i - 1] === s ? out[i - 1]! : i + 1));
  return out;
}

export function rankFromCount(countAbove: number): number {
  return countAbove + 1;
}

/** WHY: either way the rank comes from the server count. */
export type MyLine =
  | { kind: 'entry'; entry: BoardEntry; rank: number }
  | { kind: 'ghost'; uid: string; score: number; rank: number };

const uidOf = (me: MyLine) => (me.kind === 'entry' ? me.entry.uid : me.uid);

export type BoardLine =
  | { kind: 'entry'; key: string; rank: number; entry: BoardEntry; mine: boolean }
  | { kind: 'ghost'; key: string; rank: number; score: number }
  /** WHY: drawn blank, so a short board keeps its shape. */
  | { kind: 'empty'; key: string; rank: number }
  | { kind: 'gap'; key: 'gap' };

/**
 * WHY: the player's line sits after the scores it ties and pushes lines below it down a rank; it replaces
 * any copy of them in `top` and keeps their uid as its key, so moving up animates as a move.
 */
export function boardLines(input: {
  top: readonly BoardEntry[];
  order: ScoreOrder;
  limit: number;
  me: MyLine | null;
  fill?: boolean;
}): BoardLine[] {
  const limit = Math.max(0, input.limit);
  const { me } = input;
  const myUid = me ? uidOf(me) : null;
  const others = input.top.filter((e) => e.uid !== myUid);
  const myScore = me ? (me.kind === 'entry' ? me.entry.score : me.score) : 0;
  const at = me ? others.findIndex((e) => isBetter(input.order, myScore, e.score)) : -1;
  const pos = !me ? -1 : at === -1 ? others.length : at;

  type Slot = { score: number; line: (rank: number) => BoardLine };
  const slots: Slot[] = others.map((entry) => ({
    score: entry.score,
    line: (rank) => ({ kind: 'entry', key: entry.uid, rank, entry, mine: false }),
  }));
  if (me) {
    slots.splice(pos, 0, {
      score: myScore,
      line: (rank) =>
        me.kind === 'entry'
          ? { kind: 'entry', key: me.entry.uid, rank, entry: me.entry, mine: true }
          : { kind: 'ghost', key: me.uid, rank, score: me.score },
    });
  }

  const shown = slots.slice(0, limit);
  const ranks = rankWithTies(shown.map((x) => x.score));
  const lines = shown.map((x, i) => x.line(ranks[i]!));
  if (input.fill) {
    for (let r = lines.length + 1; r <= limit; r++) lines.push({ kind: 'empty', key: `empty-${r}`, rank: r });
  }
  if (!me || pos < limit) return lines;

  // WHY: below the list every shown line scores at least as well, so a line ranked right after the last hides
  // nothing.
  const mine = slots[pos]!.line(me.rank);
  return lines.length > 0 && me.rank > lines.length + 1 ? [...lines, { kind: 'gap', key: 'gap' }, mine] : [...lines, mine];
}

/**
 * WHY: it stops at the first character outside [a-z0-9] rather than skipping it, so what is stored is always the
 * address's own leading characters.
 */
export function emailPrefixOf(email: string | null | undefined): string | null {
  const at = email?.indexOf('@') ?? -1;
  if (!email || at <= 0) return null;
  const prefix = /^[a-z0-9]{0,3}/.exec(email.slice(0, at).toLowerCase())![0];
  return prefix.length > 0 ? prefix : null;
}

export function maskedEmail(prefix: string): string {
  return `${prefix}***`;
}
