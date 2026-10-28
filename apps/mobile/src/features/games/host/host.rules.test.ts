import { describe, expect, test } from 'vitest';
import {
  buildEntry,
  buildGameEndParams,
  submitOutcome,
  canRetrySubmit,
  canRevive,
  decideSubmit,
  flushSubmitLog,
  initialSession,
  initialSubmitLog,
  isFinal,
  isStalledOn,
  acceptsOver,
  initialPageRun,
  pageRunAfter,
  sessionReducer,
  submitSetbackOf,
  submitValidator,
  trackSubmit,
  type GamePageMessage,
  type SessionEvent,
  type SessionState,
  type SubmitLog,
  type SubmitReport,
} from './host.rules';

const over = { score: 420, ticks: 3000, hit: 'bus', revives: 0, revivesLeft: 2 };
const profile = { campus: 'hssc' as const, nickname: '파도왕' };

function crashed(o: Partial<typeof over> = {}): SessionState {
  let s = initialSession();
  s = sessionReducer(s, { type: 'page', message: { type: 'game:ready' } });
  s = sessionReducer(s, { type: 'runArmed', run: { id: 'r1', uid: 'u1' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:phase', phase: 'running' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over, ...o } });
  return s;
}

describe('session', () => {
  test('follows the page: loading → ready → running → crashed with the result', () => {
    const s = crashed();
    expect(s.phase).toBe('crashed');
    expect(s.over).toStrictEqual(over);
    expect(s.run).toStrictEqual({ id: 'r1', uid: 'u1' });
  });

  test('a crash with revives left opens the offer; without, the run is final at once', () => {
    expect(crashed().offer).toBe('open');
    expect(isFinal(crashed())).toBe(false);
    const last = crashed({ revives: 2, revivesLeft: 0 });
    expect(last.offer).toBe('closed');
    expect(isFinal(last)).toBe(true);
  });

  test('the offer closes when it runs out or when the ad earns nothing (shown spent)', () => {
    for (const type of ['offerExpired', 'reviveFailed'] as const) {
      let s = crashed();
      if (type === 'reviveFailed') s = sessionReducer(s, { type: 'reviveStarted' });
      s = sessionReducer(s, { type });
      expect(s.offer, type).toBe('closed');
      expect(isFinal(s), type).toBe(true);
    }
  });

  test('no ad to play makes the offer unavailable (not shown at all), and the crash final', () => {
    const s = sessionReducer(crashed(), { type: 'offerUnavailable' });
    expect(s.offer).toBe('unavailable');
    expect(isFinal(s)).toBe(true);
    expect(canRevive(s, true)).toBe(false);
  });

  test('watching the ad holds the offer open (the countdown stops)', () => {
    const s = sessionReducer(crashed(), { type: 'reviveStarted' });
    expect(s.offer).toBe('watching');
    expect(sessionReducer(s, { type: 'offerExpired' }).offer).toBe('watching');
    expect(isFinal(s)).toBe(false);
  });

  test('a revive clears the result and the offer; the next crash opens a new one', () => {
    let s = sessionReducer(crashed(), { type: 'reviveStarted' });
    s = sessionReducer(s, { type: 'page', message: { type: 'game:phase', phase: 'running' } });
    expect(s.over).toBe(null);
    expect(s.offer).toBe('none');
    s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over, score: 900, revives: 1, revivesLeft: 1 } });
    expect(s.over?.score).toBe(900);
    expect(s.offer).toBe('open');
    expect(s.run).toStrictEqual({ id: 'r1', uid: 'u1' });
  });

  test('a page reload during a crash makes the crash final rather than losing it', () => {
    for (const offer of ['open', 'watching'] as const) {
      let s = crashed();
      if (offer === 'watching') s = sessionReducer(s, { type: 'reviveStarted' });
      s = sessionReducer(s, { type: 'page', message: { type: 'game:ready' } });
      expect(s.phase, offer).toBe('crashed');
      expect(isFinal(s), offer).toBe(true);
      expect(s.over?.score, offer).toBe(420);
    }
  });

  test('a repeated game:over does not reopen an offer that closed or is being watched', () => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over } });
    expect(s.offer).toBe('closed');
    let w = sessionReducer(crashed(), { type: 'reviveStarted' });
    w = sessionReducer(w, { type: 'page', message: { type: 'game:over', ...over } });
    expect(w.offer).toBe('watching');
  });

  test('finalize closes the offer ("next" while it is still counting)', () => {
    const s = sessionReducer(crashed(), { type: 'finalize' });
    expect(isFinal(s)).toBe(true);
  });

  test('a restart after a crash that outlived a page reload goes back to the title phase', () => {
    let s = sessionReducer(crashed(), { type: 'page', message: { type: 'game:ready' } });
    expect(s.phase).toBe('crashed');
    s = sessionReducer(s, { type: 'restart' });
    expect(s.phase).toBe('ready');
  });

  test('a restart forgets the result, the run, the offer and the submission', () => {
    let s = sessionReducer(crashed(), { type: 'finalize' });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 3 });
    s = sessionReducer(s, { type: 'restart' });
    expect(s.over).toBe(null);
    expect(s.run).toBe(null);
    expect(s.offer).toBe('none');
    expect(s.submission.status).toBe('idle');
  });

  test('a submission that settles after a restart does not land on the next run', () => {
    let s = sessionReducer(crashed(), { type: 'submitStart', runId: 'r1' });
    s = sessionReducer(s, { type: 'restart' });
    s = sessionReducer(s, { type: 'runArmed', run: { id: 'r2', uid: 'u1' } });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 5 });
    expect(s.submission.status).toBe('idle');
  });

  test('the same run re-armed under the account it was claimed to starts its submission over', () => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'otherAccount' });
    s = sessionReducer(s, { type: 'runArmed', run: { id: 'r1', uid: 'g1' } });
    expect(s.run).toStrictEqual({ id: 'r1', uid: 'g1' });
    expect(s.submission.status).toBe('idle');
    expect(isFinal(s)).toBe(true);
  });

  test('submission states', () => {
    let s = sessionReducer(crashed(), { type: 'submitStart', runId: 'r1' });
    expect(s.submission.status).toBe('submitting');
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'rejected' });
    expect(s.submission).toStrictEqual({ status: 'failed', reason: 'rejected' });
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 12 });
    expect(s.submission).toStrictEqual({ status: 'submitted', rank: 12 });
    s = sessionReducer(s, { type: 'notImproved', runId: 'r1' });
    expect(s.submission).toStrictEqual({ status: 'notImproved' });
  });
});

describe('retrying a submission', () => {
  /** A final crash on r1 whose submission ended as `reason`. */
  const failed = (reason: 'network' | 'rejected' | 'otherAccount') => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    s = sessionReducer(s, { type: 'submitStart', runId: 'r1' });
    return sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason });
  };

  test('a network failure → retry → submitted', () => {
    let s = failed('network');
    expect(canRetrySubmit(s)).toBe(true);
    s = sessionReducer(s, { type: 'submitRetry', runId: 'r1' });
    expect(s.submission).toStrictEqual({ status: 'retrying' });
    // Not retryable again while it is in flight, and nothing to report yet.
    expect(canRetrySubmit(s)).toBe(false);
    expect(submitOutcome(s.submission)).toBe(null);
    s = sessionReducer(s, { type: 'submitted', runId: 'r1', rank: 4 });
    expect(s.submission).toStrictEqual({ status: 'submitted', rank: 4 });
    expect(canRetrySubmit(s)).toBe(false);
  });

  test('a retry that fails on the network again can be retried again; one refused is final', () => {
    let s = sessionReducer(failed('network'), { type: 'submitRetry', runId: 'r1' });
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'network' });
    expect(canRetrySubmit(s)).toBe(true);
    s = sessionReducer(s, { type: 'submitRetry', runId: 'r1' });
    s = sessionReducer(s, { type: 'submitFailed', runId: 'r1', reason: 'rejected' });
    expect(canRetrySubmit(s)).toBe(false);
    expect(sessionReducer(s, { type: 'submitRetry', runId: 'r1' })).toBe(s);
  });

  test('a refusal, another account, not improved and a settled write offer no retry', () => {
    const notImproved = sessionReducer(sessionReducer(crashed(), { type: 'offerExpired' }), { type: 'notImproved', runId: 'r1' });
    const submitted = sessionReducer(sessionReducer(crashed(), { type: 'offerExpired' }), { type: 'submitted', runId: 'r1', rank: 2 });
    for (const s of [failed('rejected'), failed('otherAccount'), notImproved, submitted]) {
      expect(canRetrySubmit(s)).toBe(false);
      expect(sessionReducer(s, { type: 'submitRetry', runId: 'r1' })).toBe(s);
    }
  });

  test('"next" drops the run, and the retry with it', () => {
    let s = sessionReducer(failed('network'), { type: 'restart' });
    expect(canRetrySubmit(s)).toBe(false);
    s = sessionReducer(s, { type: 'runArmed', run: { id: 'r2', uid: 'u1' } });
    expect(sessionReducer(s, { type: 'submitRetry', runId: 'r1' })).toBe(s);
    expect(s.submission.status).toBe('idle');
  });

  test('a retry names its run: one for another run changes nothing', () => {
    const s = failed('network');
    expect(sessionReducer(s, { type: 'submitRetry', runId: 'r9' })).toBe(s);
  });
});

describe('canRevive', () => {
  test('only while the offer is open and an ad is ready', () => {
    expect(canRevive(crashed(), true)).toBe(true);
    expect(canRevive(crashed(), false)).toBe(false);
    expect(canRevive(sessionReducer(crashed(), { type: 'offerExpired' }), true)).toBe(false);
    expect(canRevive(sessionReducer(crashed(), { type: 'reviveStarted' }), true)).toBe(false);
  });
});

describe('decideSubmit', () => {
  const base = {
    uid: 'u1',
    isAnonymous: false,
    emailPrefix: 'wav',
    run: { id: 'r1', uid: 'u1' },
    profile,
    score: 420,
    myBest: 300 as number | null,
    better: (a: number, b: number) => a > b,
    maxEntry: 99999,
  };

  test('a new personal best with everything in place → submit', () => {
    expect(decideSubmit(base)).toStrictEqual({ kind: 'submit' });
    expect(decideSubmit({ ...base, myBest: null })).toStrictEqual({ kind: 'submit' });
  });
  test('no better than the best already on the board → nothing to write', () => {
    expect(decideSubmit({ ...base, myBest: 420 })).toStrictEqual({ kind: 'notImproved' });
    expect(decideSubmit({ ...base, myBest: 999 })).toStrictEqual({ kind: 'notImproved' });
  });
  test('a zero or impossible score is never written', () => {
    expect(decideSubmit({ ...base, score: 0 })).toStrictEqual({ kind: 'notImproved' });
    expect(decideSubmit({ ...base, score: 100000 })).toStrictEqual({ kind: 'rejected' });
  });
  test('anonymous or signed out → sign in first, whatever a stale best says', () => {
    expect(decideSubmit({ ...base, isAnonymous: true })).toStrictEqual({ kind: 'signIn' });
    expect(decideSubmit({ ...base, uid: null })).toStrictEqual({ kind: 'signIn' });
    expect(decideSubmit({ ...base, isAnonymous: true, myBest: 999 })).toStrictEqual({ kind: 'signIn' });
  });
  test('the run belongs to the account from before sign-in → cannot', () => {
    expect(decideSubmit({ ...base, run: { id: 'r1', uid: 'anon' } })).toStrictEqual({ kind: 'otherAccount' });
  });
  test('no run at all (nobody was signed in when it started) → nothing to offer', () => {
    expect(decideSubmit({ ...base, run: null })).toStrictEqual({ kind: 'noRun' });
    expect(decideSubmit({ ...base, run: null, isAnonymous: true })).toStrictEqual({ kind: 'noRun' });
  });
  test('a time (less is better): only a faster run is written', () => {
    const time = { ...base, better: (a: number, b: number) => a < b, maxEntry: 3_600_000, myBest: 60_000 };
    expect(decideSubmit({ ...time, score: 55_000 })).toStrictEqual({ kind: 'submit' });
    expect(decideSubmit({ ...time, score: 60_000 })).toStrictEqual({ kind: 'notImproved' });
    expect(decideSubmit({ ...time, score: 70_000 })).toStrictEqual({ kind: 'notImproved' });
    expect(decideSubmit({ ...time, score: 3_600_001 })).toStrictEqual({ kind: 'rejected' });
    expect(decideSubmit({ ...time, score: 0 })).toStrictEqual({ kind: 'notImproved' });
  });
  test('no usable email prefix → cannot', () => {
    expect(decideSubmit({ ...base, emailPrefix: null })).toStrictEqual({ kind: 'rejected' });
  });
  test('no profile or no nickname → ask', () => {
    expect(decideSubmit({ ...base, profile: null })).toStrictEqual({ kind: 'setup' });
    expect(decideSubmit({ ...base, profile: { ...profile, nickname: null } })).toStrictEqual({ kind: 'setup' });
  });
});

describe('isStalledOn', () => {
  test('coming back to the same requirement means the player backed out', () => {
    expect(isStalledOn('signIn', { kind: 'signIn' })).toBe(true);
    expect(isStalledOn('setup', { kind: 'setup' })).toBe(true);
    expect(isStalledOn('signIn', { kind: 'setup' })).toBe(false);
  });
});

describe('buildEntry', () => {
  test('the fields a best-per-player entry carries, all but the server-stamped updatedAt', () => {
    expect(buildEntry({ uid: 'u1', runId: 'r1', over, profile, emailPrefix: 'wav' })).toStrictEqual({ uid: 'u1', runId: 'r1', score: 420, revives: 0, nickname: '파도왕', emailPrefix: 'wav', campus: 'hssc' });
  });
});

describe('submitValidator', () => {
  test('a hosted page is scored by the version its game.over names, and without one by none', () => {
    expect(submitValidator({ ...over, validator: 'wave-run@2' })).toBe('wave-run@2');
    expect(submitValidator(over)).toBeNull();
  });
});

describe('submitSetbackOf', () => {
  const err = (code: string) => Object.assign(new Error(code), { code });

  test('not better than the best on the board is notImproved', () => {
    expect(submitSetbackOf(err('failed-precondition'))).toBe('notImproved');
  });

  test('the server refusing the run, the score, the profile or the version is rejected', () => {
    expect(submitSetbackOf(err('permission-denied'))).toBe('rejected');
    expect(submitSetbackOf(err('invalid-argument'))).toBe('rejected');
  });

  test('what may not have been the function\'s answer stays retryable', () => {
    for (const code of ['unavailable', 'deadline-exceeded', 'internal']) expect(submitSetbackOf(err(code)), code).toBe('network');
    expect(submitSetbackOf(new Error('timeout'))).toBe('network');
    expect(submitSetbackOf(null)).toBe('network');
  });
});

describe('analytics params', () => {
  test('game_end carries the result, the host clock and the page figures, prefixed', () => {
    const params = buildGameEndParams({
      gameId: 'subway-typing',
      playId: 'p1',
      over: {
        score: 61234,
        ticks: 238,
        hit: null,
        revives: 0,
        revivesLeft: 0,
        stats: { kpm: 233 },
        telemetry: { minKeyMs: 38, bulkInputs: 1, game_id: 9 },
      },
      wallMs: 62000.4,
      bgMs: 0,
    });
    expect(params).toStrictEqual({
      s_kpm: 233,
      t_min_key_ms: 38,
      t_bulk_inputs: 1,
      t_game_id: 9,
      game_id: 'subway-typing',
      play_id: 'p1',
      score: 61234,
      ticks: 238,
      revives: 0,
      wall_ms: 62000,
      bg_ms: 0,
    });
  });

  test('game_end names what ended a run, when something did', () => {
    const params = buildGameEndParams({ gameId: 'wave-run', playId: 'p', over, wallMs: 1, bgMs: 0 });
    expect(params.hit).toBe('bus');
  });

  test('a settled submission reports its outcome; an unsettled one nothing', () => {
    expect(submitOutcome({ status: 'submitted', rank: 3 })).toStrictEqual({ outcome: 'submitted', rank: 3 });
    expect(submitOutcome({ status: 'submitted', rank: null })).toStrictEqual({ outcome: 'submitted' });
    expect(submitOutcome({ status: 'notImproved' })).toStrictEqual({ outcome: 'not_improved' });
    expect(submitOutcome({ status: 'failed', reason: 'rejected' })).toStrictEqual({ outcome: 'failed_rejected' });
    expect(submitOutcome({ status: 'failed', reason: 'network' })).toStrictEqual({ outcome: 'failed_network' });
    expect(submitOutcome({ status: 'failed', reason: 'otherAccount' })).toStrictEqual({ outcome: 'failed_other_account' });
    expect(submitOutcome({ status: 'idle' })).toBe(null);
    expect(submitOutcome({ status: 'submitting' })).toBe(null);
  });
});

describe('game_submit reports', () => {
  /** Walk `events` from a final crash on r1 (play p1), collecting every report and the log left at the end. */
  const walk = (events: SessionEvent[], playId: string | null = 'p1') => {
    let s = sessionReducer(crashed(), { type: 'offerExpired' });
    let log: SubmitLog = initialSubmitLog;
    const reports: SubmitReport[] = [];
    for (const e of events) {
      s = sessionReducer(s, e);
      const next = trackSubmit(log, s, playId);
      log = next.log;
      reports.push(...next.reports);
    }
    return { reports, log };
  };
  const start = { type: 'submitStart', runId: 'r1' } as const;
  const failNetwork = { type: 'submitFailed', runId: 'r1', reason: 'network' } as const;
  const retry = { type: 'submitRetry', runId: 'r1' } as const;

  test('a network failure then a retry that lands reports only the write', () => {
    const { reports, log } = walk([start, failNetwork, retry, { type: 'submitted', runId: 'r1', rank: 4 }]);
    expect(reports).toStrictEqual([{ play_id: 'p1', outcome: 'submitted', rank: 4 }]);
    expect(flushSubmitLog(log)).toStrictEqual([]);
  });

  test('a network failure held through a failed retry is reported once, when "next" drops the run', () => {
    const held = walk([start, failNetwork, retry, failNetwork]);
    expect(held.reports).toStrictEqual([]);
    const { reports } = walk([start, failNetwork, retry, failNetwork, { type: 'restart' }, { type: 'runArmed', run: { id: 'r2', uid: 'u1' } }]);
    expect(reports).toStrictEqual([{ play_id: 'p1', outcome: 'failed_network' }]);
  });

  test('leaving the screen with a network failure still held reports it', () => {
    const { reports, log } = walk([start, failNetwork]);
    expect(reports).toStrictEqual([]);
    expect(flushSubmitLog(log)).toStrictEqual([{ play_id: 'p1', outcome: 'failed_network' }]);
  });

  test('a write, "not improved" and a refusal are reported at once, once', () => {
    expect(walk([start, { type: 'submitted', runId: 'r1', rank: null }, { type: 'finalize' }]).reports).toStrictEqual([
      { play_id: 'p1', outcome: 'submitted' },
    ]);
    expect(walk([{ type: 'notImproved', runId: 'r1' }]).reports).toStrictEqual([{ play_id: 'p1', outcome: 'not_improved' }]);
    const refused = walk([start, failNetwork, retry, { type: 'submitFailed', runId: 'r1', reason: 'rejected' }]);
    expect(refused.reports).toStrictEqual([{ play_id: 'p1', outcome: 'failed_rejected' }]);
    expect(flushSubmitLog(refused.log)).toStrictEqual([]);
  });

  test('with no play on screen nothing is reported', () => {
    expect(walk([start, { type: 'submitted', runId: 'r1', rank: 1 }], null).reports).toStrictEqual([]);
  });
});

describe('page run order', () => {
  const after = (...messages: GamePageMessage[]) => messages.reduce(pageRunAfter, initialPageRun);
  const over = { type: 'game:over', score: 9, ticks: 1, hit: null, revives: 0, revivesLeft: 0 } as const;

  test('a result counts only for a run the page started', () => {
    expect(acceptsOver(after({ type: 'game:ready' }, { type: 'game:start' }))).toBe(true);
    expect(acceptsOver(after({ type: 'game:ready' }, { type: 'game:phase', phase: 'running' }))).toBe(true);
  });

  test('a result with no run behind it is ignored', () => {
    expect(acceptsOver(initialPageRun)).toBe(false);
    expect(acceptsOver(after({ type: 'game:ready' }))).toBe(false);
    expect(acceptsOver(after({ type: 'game:start' }, { type: 'game:phase', phase: 'ready' }))).toBe(false);
  });

  test('one run, one result: a repeat is ignored until a revive runs it on', () => {
    const ended = after({ type: 'game:start' }, over);
    expect(acceptsOver(ended)).toBe(false);
    expect(acceptsOver(pageRunAfter(ended, { type: 'game:phase', phase: 'running' }))).toBe(true);
  });

  test('a pause, a crash phase or a haptic does not end the run', () => {
    for (const m of [
      { type: 'game:phase', phase: 'paused' },
      { type: 'game:phase', phase: 'crashed' },
      { type: 'game:haptic', style: 'light' },
    ] as const) {
      expect(acceptsOver(after({ type: 'game:start' }, m)), JSON.stringify(m)).toBe(true);
    }
  });
});
