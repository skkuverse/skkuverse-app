import { describe, expect, test } from 'vitest';
import type { AppCheckFailureKind, AppCheckProbe } from '@/platform/app-check.rules';
import {
  createAnonymousSession,
  LADDERS,
  ladderFor,
  probeStopsSignIn,
  retryDelay,
  RETRY_DELAYS_MS,
  STEADY_DELAY_MS,
  type AnonAttemptReport,
  type AnonymousSessionDeps,
} from './anon-session.rules';
import { classifyAnonFailure } from './sign-in-errors.rules';

type Timer = { id: number; fn: () => void; ms: number };

const withCode = (code: string) => Object.assign(new Error(code), { code });
const probeOk: AppCheckProbe = { ok: true, ms: 5 };
const probeBounded: AppCheckProbe = { ok: false, kind: 'bounded', ms: 3_000 };
const probeFailed = (kind: AppCheckFailureKind, code?: string): AppCheckProbe => ({
  ok: false,
  kind,
  ...(code !== undefined && { code }),
  ms: 20,
});

/** Manual clock: nothing fires until the test says so. */
function harness(opts: { user?: boolean; classify?: AnonymousSessionDeps['classify'] } = {}) {
  const timers: Timer[] = [];
  let nextId = 1;
  let now = 1_000_000;
  const reports: AnonAttemptReport[] = [];
  let user = opts.user ?? false;
  let signInCalls = 0;
  let probeCalls = 0;
  // Each signIn call takes the next queued outcome; an unqueued call hangs
  // until settled by hand through `pending`.
  const outcomes: ('ok' | 'fail' | 'throw' | { reject: unknown })[] = [];
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  // Each probe takes the next queued answer, ok when none is queued; a
  // `'hang'` waits until settled through `pendingProbes`.
  const probes: (AppCheckProbe | 'hang')[] = [];
  const pendingProbes: ((probe: AppCheckProbe) => void)[] = [];

  const session = createAnonymousSession({
    hasUser: () => user,
    signIn: () => {
      signInCalls++;
      const next = outcomes.shift();
      if (next === 'ok') {
        user = true;
        return Promise.resolve();
      }
      if (next === 'fail') return Promise.reject(new Error('quota'));
      if (next === 'throw') throw new Error('sync');
      if (next) return Promise.reject(next.reject);
      return new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            user = true;
            resolve();
          },
          reject,
        });
      });
    },
    probe: () => {
      probeCalls++;
      const next = probes.shift() ?? probeOk;
      if (next === 'hang') return new Promise<AppCheckProbe>((resolve) => pendingProbes.push(resolve));
      return Promise.resolve(next);
    },
    classify: opts.classify ?? classifyAnonFailure,
    onAttempt: (report) => reports.push(report),
    timeoutMs: 8_000,
    now: () => now,
    setTimer: (fn, ms) => {
      const t = { id: nextId++, fn, ms };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
    random: () => 0.5, // jitter factor exactly 1.0
  });

  return {
    session,
    timers,
    reports,
    /** The failures alone, as the old `onFirstFailure` saw them. */
    get failures() {
      return reports.filter((r) => r.result !== 'ok');
    },
    outcomes,
    pending,
    probes,
    pendingProbes,
    get signInCalls() {
      return signInCalls;
    },
    get probeCalls() {
      return probeCalls;
    },
    setUser: (v: boolean) => {
      user = v;
    },
    advance: (ms: number) => {
      now += ms;
    },
    /** Fire the oldest scheduled timer, moving the clock to it. */
    fire: () => {
      const t = timers.shift();
      expect(t, 'expected a scheduled timer').toBeTruthy();
      // WHY: toBeTruthy does not narrow the type the way assert.ok did; it has already thrown if t is missing.
      now += t!.ms;
      t!.fn();
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('anonymous session', () => {
  test('existing session: never signs in, resolves true', async () => {
    const h = harness({ user: true });
    expect(await h.session.ensure()).toBe(true);
    expect(h.signInCalls).toBe(0);
  });

  test('first attempt succeeds: nothing scheduled, the attempt reported ok', async () => {
    const h = harness();
    h.outcomes.push('ok');
    expect(await h.session.ensure()).toBe(true);
    await flush();
    expect(h.signInCalls).toBe(1);
    expect(h.timers.length, 'no retry and the start timeout cleared').toBe(0);
    expect(h.reports).toEqual([{ trigger: 'cold', attempt: 1, ms: 0, result: 'ok' }]);
  });

  test('failure never rejects, schedules a retry, and the retry recovers', async () => {
    const h = harness();
    h.outcomes.push('fail', 'ok');
    expect(await h.session.ensure()).toBe(false);
    await flush();
    expect(h.failures.length).toBe(1);
    expect(h.timers.length).toBe(1);
    expect(h.timers[0].ms).toBe(RETRY_DELAYS_MS[0]);

    h.fire();
    await flush();
    expect(h.signInCalls, 'the recovery path must actually execute').toBe(2);
    expect(h.timers.length, 'success stops the schedule').toBe(0);
  });

  test('every attempt is reported, with its trigger and count', async () => {
    const h = harness();
    h.outcomes.push('fail', 'fail', 'fail');
    await h.session.ensure();
    await flush();
    h.fire();
    await flush();
    h.fire();
    await flush();
    expect(h.signInCalls).toBe(3);
    expect(h.reports.map((r) => [r.trigger, r.attempt, r.result])).toEqual([
      ['cold', 1, 'transient'],
      ['retry', 2, 'transient'],
      ['retry', 3, 'transient'],
    ]);
    expect(h.reports[0]?.error).toBeInstanceOf(Error);
  });

  test('backs off through the schedule', async () => {
    const h = harness();
    h.outcomes.push('fail', 'fail', 'fail');
    await h.session.ensure();
    await flush();
    const seen = [h.timers[0].ms];
    h.fire();
    await flush();
    seen.push(h.timers[0].ms);
    h.fire();
    await flush();
    seen.push(h.timers[0].ms);
    expect(seen).toStrictEqual(RETRY_DELAYS_MS.slice(0, 3));
  });

  // The race: a retry landing after Google sign-in would replace the Google
  // user with a new anonymous one.
  test('a retry that fires after a sign-in elsewhere does not call signIn', async () => {
    const h = harness();
    h.outcomes.push('fail');
    await h.session.ensure();
    await flush();
    h.setUser(true); // Google sign-in landed while the timer waited
    h.fire();
    await flush();
    expect(h.signInCalls).toBe(1);
  });

  test('pause waits out an attempt in flight and suppresses its retry', async () => {
    const h = harness();
    const started = h.session.ensure();
    // The start timeout fires first: launch moves on, the attempt keeps going.
    const startTimeout = h.timers.shift()!;
    startTimeout.fn();
    expect(await started).toBe(false);

    let paused = false;
    const pausing = h.session.pause().then(() => {
      paused = true;
    });
    await flush();
    expect(paused, 'must not return while signIn is in flight').toBe(false);

    h.pending[0].reject(new Error('quota'));
    await pausing;
    expect(h.timers.length, 'no retry while paused').toBe(0);
  });

  test('resume re-arms only when still signed out', async () => {
    const h = harness();
    await h.session.pause();
    h.session.resume();
    expect(h.timers.length, 'signed out → retry scheduled').toBe(1);

    const g = harness();
    await g.session.pause();
    g.setUser(true); // Google sign-in succeeded
    g.session.resume();
    expect(g.timers.length).toBe(0);
  });

  test('a timed-out first attempt schedules its own retry when it fails', async () => {
    const h = harness();
    const started = h.session.ensure();
    h.timers.shift()!.fn();
    expect(await started).toBe(false);
    expect(h.timers.length).toBe(0);

    h.pending[0].reject(new Error('offline'));
    await flush();
    expect(h.timers.length).toBe(1);
    expect(h.failures.length).toBe(1);
  });

  test('foreground retries at once, replacing the pending timer', async () => {
    const h = harness();
    h.outcomes.push('fail', 'ok');
    await h.session.ensure();
    await flush();
    expect(h.timers.length).toBe(1);

    h.session.onForeground();
    await flush();
    expect(h.signInCalls).toBe(2);
    expect(h.timers.length).toBe(0);
    expect(h.reports[1]?.trigger).toBe('foreground');
  });

  test('foreground is a no-op while an attempt is in flight or when signed in', async () => {
    const h = harness();
    void h.session.ensure();
    h.session.onForeground();
    await flush();
    expect(h.signInCalls, 'single flight').toBe(1);

    const g = harness({ user: true });
    g.session.onForeground();
    expect(g.signInCalls).toBe(0);
  });

  test('pauses nest: one resume of two pauses keeps retries off', async () => {
    const h = harness();
    await h.session.pause();
    await h.session.pause(); // a double-tapped sign-in
    h.session.resume();
    expect(h.timers.length, 'the first flow is still on screen').toBe(0);
    h.session.onForeground();
    expect(h.signInCalls).toBe(0);
    h.session.resume();
    expect(h.timers.length).toBe(1);
  });

  test('resume without a pause does not go negative', async () => {
    const h = harness();
    h.session.resume();
    h.session.resume();
    await h.session.pause();
    expect(await h.session.ensure()).toBe(false);
    await flush();
    expect(h.signInCalls, 'a single pause must still hold').toBe(0);
  });

  test('foreground before the first ensure is a no-op', async () => {
    const h = harness();
    h.session.onForeground(); // AppState 'active' during cold start, pre App Check
    await flush();
    expect(h.signInCalls).toBe(0);
  });

  test('a cancelled timer does not advance the backoff', async () => {
    const h = harness();
    h.outcomes.push('fail');
    await h.session.ensure();
    await flush();
    expect(h.timers[0].ms).toBe(RETRY_DELAYS_MS[0]);
    await h.session.pause(); // cancels it
    h.session.resume();
    expect(h.timers[0].ms, 'still the first step').toBe(RETRY_DELAYS_MS[0]);
  });

  test('an attempt that succeeds during a pause schedules nothing', async () => {
    const h = harness();
    const started = h.session.ensure();
    h.timers.shift()!.fn(); // launch timeout
    await started;
    const pausing = h.session.pause();
    h.pending[0].resolve();
    await pausing;
    h.session.resume();
    expect(h.timers.length).toBe(0);
    expect(h.failures.length).toBe(0);
  });

  test('a synchronous throw from signIn is a failure, not an escape', async () => {
    const h = harness();
    h.outcomes.push('throw', 'ok');
    expect(await h.session.ensure()).toBe(false);
    await flush();
    expect(h.failures.length).toBe(1);
    h.fire();
    await flush();
    expect(h.signInCalls, 'inFlight was cleared, so the retry ran').toBe(2);
  });

  test('ensure while paused makes no attempt', async () => {
    const h = harness();
    await h.session.pause();
    expect(await h.session.ensure()).toBe(false);
    expect(h.signInCalls).toBe(0);
  });

  test('ensure after a sign-out re-signs in and replaces a pending retry', async () => {
    const h = harness();
    h.outcomes.push('fail', 'ok');
    await h.session.ensure();
    await flush();
    expect(h.timers.length).toBe(1);
    expect(await h.session.ensure('signout')).toBe(true);
    await flush();
    expect(h.timers.length).toBe(0);
    expect(h.signInCalls).toBe(2);
    expect(h.reports[1]?.trigger).toBe('signout');
  });

  test('a pause in the same tick as an attempt still prevents the call', async () => {
    const h = harness();
    void h.session.ensure();
    await h.session.pause(); // before the probe has answered
    expect(h.signInCalls).toBe(0);
    // The pause did not wait for the probe (F5); let the attempt end so the launch timeout clears.
    await flush();
    h.session.resume();
    expect(h.timers.length, 'still signed out, so the retry re-arms').toBe(1);
  });
});

describe('the probe before an attempt', () => {
  test('only a quota stops the sign-in', () => {
    expect(probeStopsSignIn('throttled')).toBe(true);
    expect(probeStopsSignIn('backoff')).toBe(true);
    for (const kind of ['network', 'bounded', 'rejected', 'unsupported', 'other'] as const) {
      expect(probeStopsSignIn(kind), kind).toBe(false);
    }
  });

  test('a throttled or backing-off probe skips signIn, and the attempt reports the probe', async () => {
    for (const kind of ['throttled', 'backoff'] as const) {
      // Arrange
      const h = harness();
      h.probes.push(probeFailed(kind, '-8'));
      // Act
      expect(await h.session.ensure(), kind).toBe(false);
      await flush();
      // Assert
      expect(h.signInCalls, kind).toBe(0);
      expect(h.probeCalls, kind).toBe(1);
      expect(h.reports, kind).toEqual([{ trigger: 'cold', attempt: 1, ms: 0, result: 'app_check', acKind: kind, code: '-8' }]);
      expect(h.timers[0]?.ms, `${kind}: retried on its own ladder`).toBe(LADDERS[kind].steps[0]);
    }
  });

  // Until Auth enforces App Check it accepts these sign-ins; skipping them
  // would sign nobody in from the moment the OTA lands.
  test('any other failed probe still calls signIn, and a success names the probe', async () => {
    const probes = [
      probeFailed('network', '-3'),
      probeBounded,
      probeFailed('rejected', '403'),
      probeFailed('unsupported', '-14'),
      probeFailed('other', '-16'),
    ];
    for (const probe of probes) {
      if (probe.ok) throw new Error('the table holds failures');
      const { kind, code } = probe;
      // Arrange
      const h = harness();
      h.probes.push(probe);
      h.outcomes.push('ok');
      // Act
      expect(await h.session.ensure(), kind).toBe(true);
      await flush();
      // Assert
      expect(h.signInCalls, kind).toBe(1);
      expect(h.reports, kind).toEqual([
        { trigger: 'cold', attempt: 1, ms: 0, result: 'ok', acKind: kind, ...(code !== undefined && { code }) },
      ]);
      expect(h.timers.length, `${kind}: nothing to retry`).toBe(0);
    }
  });

  test('a sign-in refused after a failed probe is classified by the probe', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('network', '-3'));
    h.outcomes.push({ reject: withCode('auth/internal-error') });
    // Act
    expect(await h.session.ensure()).toBe(false);
    await flush();
    // Assert
    expect(h.signInCalls).toBe(1);
    expect(h.reports[0]).toMatchObject({ result: 'network', acKind: 'network', code: '-3', error: withCode('auth/internal-error') });
    expect(h.timers[0]?.ms, 'retried on the transient ladder').toBe(RETRY_DELAYS_MS[0]);
  });

  test('a probe that answers with the user already signed in makes no call', async () => {
    // Arrange
    const h = harness();
    h.probes.push('hang');
    const started = h.session.ensure();
    await flush();
    h.setUser(true); // Google sign-in landed while the probe ran
    // Act
    h.pendingProbes[0]!(probeOk);
    // Assert
    expect(await started).toBe(true);
    expect(h.signInCalls).toBe(0);
    expect(h.reports.length, 'nothing to report: no attempt was made').toBe(0);
  });

  // F5: the Google sheet must open at once, not after the probe's 3 s.
  test('pause() does not wait for a pending probe, and the probe then signs nobody in', async () => {
    // Arrange
    const h = harness();
    h.probes.push('hang');
    void h.session.ensure();
    await flush();
    // Act
    let paused = false;
    const pausing = h.session.pause().then(() => {
      paused = true;
    });
    await flush();
    // Assert
    expect(paused, 'returned with the probe still pending').toBe(true);
    await pausing;
    h.pendingProbes[0]!(probeOk);
    await flush();
    expect(h.signInCalls, 'the abandoned probe issues no sign-in').toBe(0);
    expect(h.timers.length, 'and arms nothing while paused').toBe(0);
    h.session.resume();
    expect(h.timers.length, 'resume re-arms the retry').toBe(1);
  });

  test('a probe that rejects is read as an unclassified failure, never an escape', async () => {
    // Arrange
    const h = harness();
    h.probes.push('hang');
    const started = h.session.ensure();
    await flush();
    // Act
    (h.pendingProbes[0] as unknown as (p: Promise<never>) => void)(Promise.reject(new Error('broken probe')));
    // Assert
    expect(await started).toBe(false);
    expect(h.signInCalls).toBe(0);
    expect(h.reports[0]).toMatchObject({ result: 'transient', error: new Error('broken probe') });
    expect(h.timers.length).toBe(1);
  });

  test('a sign-in refused after an ok probe is classified from its rejection', async () => {
    // Arrange
    const h = harness();
    h.outcomes.push({ reject: withCode('auth/too-many-requests') });
    // Act
    await h.session.ensure();
    await flush();
    // Assert
    expect(h.reports[0]).toMatchObject({ result: 'quota', code: 'auth/too-many-requests' });
    expect(h.timers[0]?.ms).toBe(LADDERS.quota.steps[0]);
  });
});

describe('the ladders', () => {
  test('a throttle waits its floor, then its steps, and a new ladder starts at its first step', async () => {
    // Arrange
    const h = harness();
    h.outcomes.push('fail');
    h.probes.push(probeOk, probeFailed('throttled', '-8'), probeFailed('throttled', '-8'));
    await h.session.ensure();
    await flush();
    expect(h.timers[0]?.ms, 'one transient failure').toBe(RETRY_DELAYS_MS[0]);
    // Act
    h.fire();
    await flush();
    // Assert
    expect(h.reports[1]).toMatchObject({ result: 'app_check', acKind: 'throttled', code: '-8' });
    expect(h.timers[0]?.ms, 'the throttled ladder from its first step').toBe(LADDERS.throttled.steps[0]);
    h.fire();
    await flush();
    expect(h.timers[0]?.ms).toBe(LADDERS.throttled.steps[1]);
  });

  test('the SDK backing off waits at least its floor', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('backoff'));
    // Act
    await h.session.ensure();
    await flush();
    // Assert
    expect(h.timers[0]?.ms).toBe(LADDERS.backoff.steps[0]);
    expect(h.timers[0]?.ms).toBeGreaterThanOrEqual(LADDERS.backoff.floor);
  });

  test('rejected and unsupported arm no timer, and resume arms none either', async () => {
    for (const kind of ['rejected', 'unsupported'] as const) {
      // Arrange
      const h = harness();
      h.probes.push(probeFailed(kind));
      h.outcomes.push({ reject: withCode('auth/internal-error') });
      // Act
      expect(await h.session.ensure(), kind).toBe(false);
      await flush();
      // Assert
      expect(h.signInCalls, kind).toBe(1);
      expect(h.reports[0], kind).toMatchObject({ result: 'app_check', acKind: kind });
      expect(h.timers.length, `${kind}: no timer`).toBe(0);
      await h.session.pause();
      h.session.resume();
      expect(h.timers.length, `${kind}: resume arms nothing`).toBe(0);
    }
  });

  test('no foreground retry inside a throttle floor; one past it', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('throttled', '-8'), probeOk);
    h.outcomes.push('ok');
    await h.session.ensure();
    await flush();
    // Act
    h.advance(LADDERS.throttled.floor - 1);
    h.session.onForeground();
    await flush();
    // Assert
    expect(h.probeCalls, 'inside the floor').toBe(1);
    h.advance(1);
    h.session.onForeground();
    await flush();
    expect(h.probeCalls, 'past the floor').toBe(2);
    expect(h.signInCalls).toBe(1);
  });

  test('a rejected or unsupported device never retries on a foreground, only for the user', async () => {
    for (const kind of ['rejected', 'unsupported'] as const) {
      // Arrange
      const h = harness();
      h.probes.push(probeFailed(kind), probeFailed(kind));
      h.outcomes.push({ reject: withCode('auth/internal-error') }, 'ok');
      await h.session.ensure();
      await flush();
      h.advance(3_600_000);
      // Act
      h.session.onForeground();
      await flush();
      // Assert
      expect(h.probeCalls, `${kind}: a foreground attests nothing`).toBe(1);
      expect(h.session.retryNow(), kind).toBe('unavailable');
      await flush();
      expect(h.probeCalls, `${kind}: a manual retry attempts`).toBe(2);
      expect(h.signInCalls, kind).toBe(2);
      expect(h.reports[1]?.trigger, kind).toBe('manual');
    }
  });

  test('a resume during an attempt arms no timer, so a stricter failure sets the only one', async () => {
    // Arrange
    const h = harness();
    h.probes.push('hang');
    void h.session.ensure();
    await flush();
    // Act
    await h.session.pause();
    h.session.resume();
    // Assert
    expect(h.timers.map((t) => t.ms), 'only the launch timeout while the attempt runs').toEqual([8_000]);
    h.pendingProbes[0]!(probeFailed('throttled', '-8'));
    await flush();
    expect(h.timers.map((t) => t.ms), 'the throttled ladder alone').toEqual([LADDERS.throttled.steps[0]]);
  });

  test('a classifier that throws reads as transient, and the scheduler keeps working', async () => {
    // Arrange
    let broken = true;
    const h = harness({
      classify: (error, probe) => {
        if (broken) throw new Error('classifier bug');
        return classifyAnonFailure(error, probe);
      },
    });
    h.outcomes.push('fail', 'ok');
    void h.session.ensure();
    await flush();
    // Act
    await h.session.pause();
    h.session.resume();
    // Assert
    expect(h.reports[0]).toMatchObject({ result: 'transient', error: new Error('quota') });
    expect(h.timers.map((t) => t.ms)).toEqual([RETRY_DELAYS_MS[0]]);
    broken = false;
    h.fire();
    await flush();
    expect(h.signInCalls, 'the retry ran').toBe(2);
  });

  test('a success returns the scheduler to the transient ladder', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('throttled'), probeOk);
    h.outcomes.push('ok', 'fail');
    await h.session.ensure();
    await flush();
    h.fire();
    await flush();
    expect(h.signInCalls).toBe(1);
    // Act
    h.setUser(false);
    await h.session.ensure('signout');
    await flush();
    // Assert
    expect(h.timers[0]?.ms).toBe(RETRY_DELAYS_MS[0]);
  });
});

describe('retryNow', () => {
  test('retries like a foreground, and says connecting while a ladder still runs', async () => {
    // Arrange
    const h = harness();
    h.outcomes.push('fail', 'ok');
    await h.session.ensure();
    await flush();
    // Act
    const reason = h.session.retryNow();
    await flush();
    // Assert
    expect(reason).toBe('connecting');
    expect(h.signInCalls).toBe(2);
    expect(h.reports[1]?.trigger).toBe('manual');
    expect(h.timers.length, 'the pending retry was replaced').toBe(0);
  });

  test('respects the floor: inside it, nothing runs and the reason is still connecting', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('throttled', '-8'), probeOk);
    h.outcomes.push('ok');
    await h.session.ensure();
    await flush();
    // Act
    h.advance(LADDERS.throttled.floor - 1);
    expect(h.session.retryNow()).toBe('connecting');
    await flush();
    // Assert
    expect(h.probeCalls).toBe(1);
    h.advance(1);
    expect(h.session.retryNow()).toBe('connecting');
    await flush();
    expect(h.signInCalls).toBe(1);
  });

  test('a rejected or unsupported device is unavailable, and a manual retry still runs', async () => {
    // Arrange
    const h = harness();
    h.probes.push(probeFailed('rejected', '403'), probeFailed('rejected', '403'));
    h.outcomes.push({ reject: withCode('auth/internal-error') }, { reject: withCode('auth/internal-error') });
    await h.session.ensure();
    await flush();
    // Act
    const reason = h.session.retryNow();
    await flush();
    // Assert
    expect(reason).toBe('unavailable');
    expect(h.probeCalls).toBe(2);
    expect(h.signInCalls).toBe(2);
    expect(h.reports[1]?.trigger).toBe('manual');
    expect(h.timers.length).toBe(0);
  });

  test('before the first ensure, or signed in, it only reports', async () => {
    const h = harness();
    expect(h.session.retryNow()).toBe('connecting');
    await flush();
    expect(h.probeCalls).toBe(0);

    const g = harness({ user: true });
    expect(g.session.retryNow()).toBe('connecting');
    expect(g.probeCalls).toBe(0);
  });
});

describe('retryDelay', () => {
  test('jitter spans 0.5x to 1.5x of the base', () => {
    expect(retryDelay(0, () => 0)).toBe(RETRY_DELAYS_MS[0] * 0.5);
    expect(retryDelay(0, () => 0.999999)).toBe(Math.round(RETRY_DELAYS_MS[0] * 1.499999));
  });

  test('past the schedule, the steady delay repeats', () => {
    const past = RETRY_DELAYS_MS.length;
    expect(retryDelay(past, () => 0.5)).toBe(STEADY_DELAY_MS);
    expect(retryDelay(past + 10, () => 0.5)).toBe(STEADY_DELAY_MS);
  });

  test('the floor is applied after jitter', () => {
    // The throttled first step jittered to half would be 30 s; the floor holds it at 60 s.
    expect(retryDelay(0, () => 0, 'throttled')).toBe(LADDERS.throttled.floor);
    expect(retryDelay(0, () => 0.999999, 'throttled')).toBe(Math.round(LADDERS.throttled.steps[0] * 1.499999));
    expect(retryDelay(0, () => 0, 'backoff')).toBe(LADDERS.backoff.floor);
    expect(retryDelay(0, () => 0, 'quota')).toBe(LADDERS.quota.steps[0] * 0.5);
  });

  test('each ladder has its own steady delay', () => {
    expect(retryDelay(10, () => 0.5, 'throttled')).toBe(LADDERS.throttled.steady);
    expect(retryDelay(10, () => 0.5, 'backoff')).toBe(LADDERS.backoff.steady);
    expect(retryDelay(10, () => 0.5, 'quota')).toBe(LADDERS.quota.steady);
  });
});

describe('ladderFor', () => {
  test('a quota has its ladder, App Check kinds theirs, and the rest the transient one', () => {
    expect(ladderFor({ cls: 'quota' })).toBe('quota');
    expect(ladderFor({ cls: 'app_check', acKind: 'throttled' })).toBe('throttled');
    expect(ladderFor({ cls: 'app_check', acKind: 'backoff' })).toBe('backoff');
    expect(ladderFor({ cls: 'app_check', acKind: 'rejected' })).toBe('none');
    expect(ladderFor({ cls: 'app_check', acKind: 'unsupported' })).toBe('none');
    // app_check.other, and a refused token with an ok probe, retry as a transient failure.
    expect(ladderFor({ cls: 'app_check', acKind: 'other' })).toBe('transient');
    expect(ladderFor({ cls: 'app_check' })).toBe('transient');
    expect(ladderFor({ cls: 'network' })).toBe('transient');
    expect(ladderFor({ cls: 'transient' })).toBe('transient');
    expect(ladderFor({ cls: 'fatal' })).toBe('transient');
  });
});
