/**
 * WHY: game-agnostic and pure (type-only imports, no I/O); page.rules.ts reads a page's `game.*` into the messages
 * below.
 */
import type { GameHapticStyle, GameOver as PageGameOver, GamePhase, GameStats } from '@skkuverse/miniapp/protocol';
import type { UserProfile } from '@/features/profile/profile.rules';
import type { GameId } from '../games.constants';

export type GameOver = PageGameOver;

export type GamePageMessage =
  | { type: 'game:ready' }
  | { type: 'game:start' }
  | { type: 'game:phase'; phase: GamePhase }
  | { type: 'game:haptic'; style: GameHapticStyle }
  | ({ type: 'game:over' } & GameOver);

/** WHY: the uid it was stamped under is kept, since an anonymous player who signs in may come back as someone else. */
export interface ArmedRun {
  id: string;
  uid: string;
}

/**
 * WHY: `closed` (ran out, the ad earned nothing, none left) and `unavailable` (no ad loaded at the crash)
 * both make the crash final; only `closed` shows the offer, spent.
 */
export type Offer = 'none' | 'open' | 'watching' | 'closed' | 'unavailable';

/** WHY: only `network` can be retried, from the result screen while its run is on screen; the others are final. */
export type SubmitFailure = 'network' | 'rejected' | 'otherAccount';

/**
 * WHY: the request did not get through, timed out or failed on the function's side; any other code is a refusal a
 * retry would only repeat.
 */
export function isTransientCallError(e: unknown): boolean {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal';
}

/** WHY: the version is the one the page names in `game.over`, sent as named; a result without one is not submitted. */
export function submitValidator(over: GameOver): string | null {
  return over.validator ?? null;
}

export type SubmitSetback = 'notImproved' | Exclude<SubmitFailure, 'otherAccount'>;

/**
 * WHY: `failed-precondition` is not better than the best on the board (maybe set on another device);
 * `permission-denied` and `invalid-argument` are refusals. Anything else may never have been the function's
 * answer, so it stays retryable.
 */
export function submitSetbackOf(e: unknown): SubmitSetback {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  if (code === 'failed-precondition') return 'notImproved';
  if (code === 'permission-denied' || code === 'invalid-argument') return 'rejected';
  return 'network';
}

export type Submission =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'retrying' }
  | { status: 'submitted'; rank: number | null }
  | { status: 'notImproved' }
  | { status: 'failed'; reason: SubmitFailure };

export interface SessionState {
  phase: 'loading' | GamePhase;
  over: GameOver | null;
  run: ArmedRun | null;
  offer: Offer;
  submission: Submission;
}

export type SessionEvent =
  | { type: 'page'; message: GamePageMessage }
  | { type: 'runArmed'; run: ArmedRun }
  | { type: 'restart' }
  | { type: 'reviveStarted' }
  | { type: 'reviveFailed' }
  | { type: 'offerExpired' }
  | { type: 'offerUnavailable' }
  | { type: 'finalize' }
  // WHY: submission events name their run, so one that settles after a restart does not land on the run that
  // replaced it.
  | { type: 'submitStart'; runId: string }
  | { type: 'submitRetry'; runId: string }
  | { type: 'submitted'; runId: string; rank: number | null }
  | { type: 'notImproved'; runId: string }
  | { type: 'submitFailed'; runId: string; reason: SubmitFailure };

export function initialSession(): SessionState {
  return { phase: 'loading', over: null, run: null, offer: 'none', submission: { status: 'idle' } };
}

const close = (s: SessionState): SessionState =>
  s.offer === 'none' || s.offer === 'unavailable' ? s : { ...s, offer: 'closed' };

export function sessionReducer(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case 'page': {
      const m = e.message;
      switch (m.type) {
        case 'game:ready':
          // QUIRK(react-native-webview): the page's process can be killed while an ad is up; a crash on screen is
          // not lost with it but becomes final.
          if (s.phase === 'crashed' && s.over) return close(s);
          return { ...s, phase: 'ready' };
        case 'game:phase':
          // WHY: a revive retires the last result and its offer; the next crash brings its own.
          return m.phase === 'running' ? { ...s, phase: m.phase, over: null, offer: 'none' } : { ...s, phase: m.phase };
        case 'game:over': {
          // WHY: a real second crash passes through `running`, which clears `over`; a repeat of the same one must
          // not reopen the offer.
          if (s.phase === 'crashed' && s.over) return s;
          const { type: _type, ...over } = m;
          return { ...s, phase: 'crashed', over, offer: over.revivesLeft > 0 ? 'open' : 'closed' };
        }
        default:
          return s;
      }
    }
    case 'runArmed':
      // WHY: the run claimed over to another account after a sign-in; what was decided under the old uid no longer
      // holds.
      if (s.run?.id === e.run.id && s.run.uid !== e.run.uid) return { ...s, run: e.run, submission: { status: 'idle' } };
      return { ...s, run: e.run };
    case 'restart':
      // WHY: after a page reload the page is already on its title and will not say so again.
      return {
        ...s,
        phase: s.phase === 'crashed' ? 'ready' : s.phase,
        over: null,
        run: null,
        offer: 'none',
        submission: { status: 'idle' },
      };
    case 'reviveStarted':
      return s.offer === 'open' ? { ...s, offer: 'watching' } : s;
    case 'reviveFailed':
      return s.offer === 'watching' ? { ...s, offer: 'closed' } : s;
    case 'offerExpired':
      return s.offer === 'open' ? { ...s, offer: 'closed' } : s;
    case 'offerUnavailable':
      return s.offer === 'open' ? { ...s, offer: 'unavailable' } : s;
    case 'finalize':
      return close(s);
    case 'submitStart':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'submitting' } } : s;
    case 'submitRetry':
      return s.run?.id === e.runId && canRetrySubmit(s) ? { ...s, submission: { status: 'retrying' } } : s;
    case 'submitted':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'submitted', rank: e.rank } } : s;
    case 'notImproved':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'notImproved' } } : s;
    case 'submitFailed':
      return s.run?.id === e.runId ? { ...s, submission: { status: 'failed', reason: e.reason } } : s;
  }
}

/**
 * WHY: only `network` may not have been the server's answer. `submitScore` is idempotent per run, so a retry
 * after a timeout that committed lands on `submitted` too; a refusal or "not improved" would only repeat.
 */
export function canRetrySubmit(s: SessionState): boolean {
  return s.phase === 'crashed' && !!s.over && !!s.run && s.submission.status === 'failed' && s.submission.reason === 'network';
}

/**
 * WHY: tracked as messages arrive, not through a render: a `game:over` with no run behind it, or a second for one
 * run, is a page posting results it did not play for.
 */
export type PageRun = 'idle' | 'live' | 'ended';

export const initialPageRun: PageRun = 'idle';

export function pageRunAfter(r: PageRun, m: GamePageMessage): PageRun {
  switch (m.type) {
    case 'game:ready':
      return 'idle';
    case 'game:start':
      return 'live';
    case 'game:phase':
      if (m.phase === 'running') return 'live';
      return m.phase === 'ready' ? 'idle' : r;
    case 'game:over':
      return r === 'live' ? 'ended' : r;
    default:
      return r;
  }
}

export function acceptsOver(r: PageRun): boolean {
  return r === 'live';
}

export function isFinal(s: SessionState): boolean {
  return s.phase === 'crashed' && s.over !== null && (s.offer === 'closed' || s.offer === 'unavailable');
}

export function canRevive(s: SessionState, adReady: boolean): boolean {
  return s.phase === 'crashed' && s.offer === 'open' && adReady;
}

export type SubmitDecision =
  | { kind: 'submit' }
  | { kind: 'noRun' }
  | { kind: 'notImproved' }
  | { kind: 'signIn' }
  | { kind: 'otherAccount' }
  | { kind: 'rejected' }
  | { kind: 'setup' };

/**
 * WHY: gates in the order a player meets them (a @g.skku.edu account, the run stamped under it, a campus
 * and nickname, a better score), since a board keeps one line per player. A score of 0 is no result in
 * either order.
 */
export function decideSubmit(input: {
  uid: string | null;
  isAnonymous: boolean;
  emailPrefix: string | null;
  run: ArmedRun | null;
  profile: UserProfile | null;
  score: number;
  myBest: number | null;
  /** WHY: never a bare `>`: a score's direction is per game (`isBetter` with the game's order). */
  better(a: number, b: number): boolean;
  maxEntry: number;
}): SubmitDecision {
  // WHY: no run means nobody was signed in, even anonymously, when it started; signing in now would not stamp it.
  if (!input.run) return { kind: 'noRun' };
  if (input.score > input.maxEntry) return { kind: 'rejected' };
  if (input.score <= 0) return { kind: 'notImproved' };
  // WHY: before the best: an anonymous player has no entry, whatever a stale best says.
  if (!input.uid || input.isAnonymous) return { kind: 'signIn' };
  if (input.run.uid !== input.uid) return { kind: 'otherAccount' };
  if (input.myBest !== null && !input.better(input.score, input.myBest)) return { kind: 'notImproved' };
  if (!input.emailPrefix) return { kind: 'rejected' };
  if (!input.profile?.nickname) return { kind: 'setup' };
  return { kind: 'submit' };
}

/**
 * WHY: still facing the same step on return means the player backed out, so the flow stops rather than sending them
 * again.
 */
export function isStalledOn(awaiting: 'signIn' | 'setup', decision: SubmitDecision): boolean {
  return decision.kind === awaiting;
}

/** WHY: `updatedAt` is left to the server stamp. */
export function buildEntry(input: {
  uid: string;
  runId: string;
  over: GameOver;
  profile: UserProfile;
  emailPrefix: string;
}) {
  return {
    uid: input.uid,
    runId: input.runId,
    score: input.over.score,
    revives: input.over.revives,
    nickname: input.profile.nickname!,
    emailPrefix: input.emailPrefix,
    campus: input.profile.campus,
  };
}

export type EntryFields = ReturnType<typeof buildEntry>;

/**
 * WHY: the page's figures are prefixed, `s_` for display stats and `t_` for telemetry, so neither can
 * overwrite the host's. SEE: docs/explanation/analytics.md
 */
export type GameEndParams = {
  game_id: GameId;
  play_id: string;
  score: number;
  ticks: number;
  revives: number;
  hit?: string;
  /** WHY: the host's clock, not the page's. */
  wall_ms: number;
  bg_ms: number;
} & { readonly [page: `s_${string}` | `t_${string}`]: number };

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function prefixed(prefix: 's_' | 't_', figures: GameStats | undefined) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(figures ?? {})) out[`${prefix}${snake(k)}`] = v;
  return out;
}

export function buildGameEndParams(input: {
  gameId: GameId;
  playId: string;
  over: GameOver;
  wallMs: number;
  bgMs: number;
}): GameEndParams {
  const { over } = input;
  return {
    ...prefixed('s_', over.stats),
    ...prefixed('t_', over.telemetry),
    game_id: input.gameId,
    play_id: input.playId,
    score: over.score,
    ticks: over.ticks,
    revives: over.revives,
    ...(over.hit !== null && { hit: over.hit }),
    wall_ms: Math.round(input.wallMs),
    bg_ms: Math.round(input.bgMs),
  };
}

export type SubmitOutcome = 'submitted' | 'not_improved' | 'failed_network' | 'failed_rejected' | 'failed_other_account';

export type GameSubmitParams = {
  game_id: GameId;
  play_id: string;
  outcome: SubmitOutcome;
  rank?: number;
};

/**
 * WHY: a settled `network` failure may still be retried, so `game_submit` reads this through `trackSubmit`, never
 * directly.
 */
export function submitOutcome(s: Submission): Pick<GameSubmitParams, 'outcome' | 'rank'> | null {
  switch (s.status) {
    case 'submitted':
      return s.rank === null ? { outcome: 'submitted' } : { outcome: 'submitted', rank: s.rank };
    case 'notImproved':
      return { outcome: 'not_improved' };
    case 'failed':
      return { outcome: s.reason === 'network' ? 'failed_network' : s.reason === 'rejected' ? 'failed_rejected' : 'failed_other_account' };
    default:
      return null;
  }
}

export type SubmitReport = Pick<GameSubmitParams, 'play_id' | 'outcome' | 'rank'>;

export interface SubmitLog {
  seen: Submission | null;
  /**
   * WHY: not reported while a retry could still turn it into `submitted`; `failed_network` only once its run is
   * dropped.
   */
  held: { runId: string; report: SubmitReport } | null;
}

export const initialSubmitLog: SubmitLog = { seen: null, held: null };

/**
 * WHY: each play reports its outcome once nothing can change it; a held network failure reports once its run is
 * gone.
 */
export function trackSubmit(log: SubmitLog, s: SessionState, playId: string | null): { log: SubmitLog; reports: SubmitReport[] } {
  const reports: SubmitReport[] = [];
  let held = log.held;
  if (held && s.run?.id !== held.runId) {
    reports.push(held.report);
    held = null;
  }
  const outcome = s.submission === log.seen ? null : submitOutcome(s.submission);
  if (outcome && playId !== null) {
    const report = { play_id: playId, ...outcome };
    if (canRetrySubmit(s) && s.run) held = { runId: s.run.id, report };
    else {
      reports.push(report);
      held = null;
    }
  }
  return { log: { seen: s.submission, held }, reports };
}

export function flushSubmitLog(log: SubmitLog): SubmitReport[] {
  return log.held ? [log.held.report] : [];
}
