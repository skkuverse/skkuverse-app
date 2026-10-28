import type { AppCheckFailureKind, AppCheckProbe } from '@/platform/app-check.rules';
import type { AnonFailure, AnonFailureClass } from './sign-in-errors.rules';

export type AnonTrigger = 'cold' | 'foreground' | 'retry' | 'signout' | 'delete' | 'manual';

export type EnsureTrigger = Extract<AnonTrigger, 'cold' | 'signout' | 'delete'>;

/** WHY: `unavailable` is a last answer no timer will change: a rejected or unsupported device. */
export type SessionReason = 'connecting' | 'unavailable';

export type RetryLadder = 'transient' | 'throttled' | 'backoff' | 'quota' | 'none';

interface Ladder {
  steps: readonly number[];
  steady: number;
  /** WHY: also the time before which no foreground or manual retry runs, so a quota is not asked again early. */
  floor: number;
}

export const LADDERS: Record<Exclude<RetryLadder, 'none'>, Ladder> = {
  transient: { steps: [5_000, 30_000, 120_000, 300_000], steady: 600_000, floor: 0 },
  throttled: { steps: [60_000, 300_000, 900_000], steady: 1_800_000, floor: 60_000 },
  backoff: { steps: [900_000], steady: 1_800_000, floor: 900_000 },
  quota: { steps: [120_000, 600_000], steady: 1_800_000, floor: 0 },
};

export const RETRY_DELAYS_MS = LADDERS.transient.steps;
export const STEADY_DELAY_MS = LADDERS.transient.steady;

// WHY: a crowd behind one NAT fails together, and without jitter would retry together.
const JITTER_MIN = 0.5;
const JITTER_SPAN = 1.0;

export interface AnonAttemptReport {
  trigger: AnonTrigger;
  attempt: number;
  ms: number;
  result: 'ok' | AnonFailureClass;
  /** WHY: kept when the sign-in then succeeds, so the probe's outcome is counted on every attempt. */
  acKind?: AppCheckFailureKind | 'bounded';
  code?: string;
  error?: unknown;
}

/**
 * WHY: only a quota skips the Auth call, which would spend the attestation the quota just refused;
 * the Google link reads it too. SEE: docs/explanation/app-check.md ("Start-up order")
 */
export function probeStopsSignIn(kind: AppCheckFailureKind | 'bounded'): boolean {
  return kind === 'throttled' || kind === 'backoff';
}

function probeFailureOf(probe: AppCheckProbe | null): Pick<AnonAttemptReport, 'acKind' | 'code'> {
  if (!probe || probe.ok) return {};
  return { acKind: probe.kind, ...(probe.code !== undefined && { code: probe.code }) };
}

export interface AnonymousSessionDeps {
  hasUser: () => boolean;
  signIn: () => Promise<unknown>;
  probe: () => Promise<AppCheckProbe>;
  classify: (error: unknown, probe: AppCheckProbe | null) => AnonFailure;
  onAttempt: (report: AnonAttemptReport) => void;
  timeoutMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  random: () => number;
}

export interface AnonymousSession {
  /** WHY: never rejects, and resolves by `timeoutMs` so launch never waits; a timed-out attempt keeps running. */
  ensure: (trigger?: EnsureTrigger) => Promise<boolean>;
  /** WHY: a no-op until the first `ensure()`, which runs after App Check is initialized. */
  onForeground: () => void;
  retryNow: () => SessionReason;
  /** WHY: waits for a `signIn` already issued, never a pending probe, so the Google sheet never waits on one. Nests. */
  pause: () => Promise<void>;
  resume: () => void;
}

export function retryDelay(
  retryIndex: number,
  random: () => number,
  ladder: Exclude<RetryLadder, 'none'> = 'transient',
): number {
  const { steps, steady, floor } = LADDERS[ladder];
  const base = steps[retryIndex] ?? steady;
  return Math.max(floor, Math.round(base * (JITTER_MIN + random() * JITTER_SPAN)));
}

export function ladderFor(failure: AnonFailure): RetryLadder {
  if (failure.cls === 'quota') return 'quota';
  if (failure.cls !== 'app_check') return 'transient';
  switch (failure.acKind) {
    case 'throttled':
      return 'throttled';
    case 'backoff':
      return 'backoff';
    case 'rejected':
    case 'unsupported':
      return 'none';
    default:
      return 'transient';
  }
}

// WHY: launch never blocks on this, since Firebase's per-IP sign-up quota strands a NAT crowd and a
// signed-out app is supported. Nothing else calls signInAnonymously, or the two race into two
// accounts. Every dependency is injected so the tests prove each recovery path runs.
export function createAnonymousSession(deps: AnonymousSessionDeps): AnonymousSession {
  let inFlight: Promise<boolean> | null = null;
  // WHY: pause() waits for this alone: a probe can take seconds, and the Google sheet must not wait on it.
  let signing: Promise<unknown> | null = null;
  let timer: unknown = null;
  let retryIndex = 0;
  let ladder: RetryLadder = 'transient';
  let notBefore = 0;
  let pauseDepth = 0;
  let started = false;
  let attempts = 0;

  function cancelTimer() {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  }

  function schedule() {
    // WHY: an attempt in flight schedules at its own end, on the ladder its failure picks; a timer
    // armed under it by a resume would outlive that.
    if (pauseDepth > 0 || inFlight !== null || timer !== null || ladder === 'none' || deps.hasUser()) return;
    timer = deps.setTimer(
      () => {
        // WHY: advanced on firing, not arming: a timer cancelled by pause() or onForeground() must not
        // push the backoff a step further.
        timer = null;
        retryIndex++;
        void attempt('retry');
      },
      retryDelay(retryIndex, deps.random, ladder),
    );
  }

  function recordFailure(failure: AnonFailure) {
    const next = ladderFor(failure);
    // WHY: a new ladder starts at its first step: a throttle after two network failures waits its
    // minute, not its half hour.
    if (next !== ladder) retryIndex = 0;
    ladder = next;
    notBefore = next === 'none' ? 0 : deps.now() + LADDERS[next].floor;
  }

  function recordSuccess() {
    retryIndex = 0;
    ladder = 'transient';
    notBefore = 0;
  }

  function mayRetryNow(): boolean {
    return started && pauseDepth === 0 && inFlight === null && !deps.hasUser() && deps.now() >= notBefore;
  }

  // WHY: a probe that throws despite its contract must still end the attempt rather than escape it.
  function startProbe(): Promise<AppCheckProbe> {
    try {
      return deps.probe();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function callSignIn(): Promise<unknown> {
    try {
      return Promise.resolve(deps.signIn());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function attempt(trigger: AnonTrigger): Promise<boolean> {
    if (inFlight) return inFlight;
    // QUIRK(firebase): signInAnonymously replaces a signed-in Google user. Checked here, not when
    // scheduled, because a sign-in can land while the timer waits.
    if (pauseDepth > 0 || deps.hasUser()) return Promise.resolve(deps.hasUser());

    const startedAt = deps.now();
    const attemptNo = ++attempts;
    const report = (outcome: Omit<AnonAttemptReport, 'trigger' | 'attempt' | 'ms'>) => {
      try {
        deps.onAttempt({ trigger, attempt: attemptNo, ms: deps.now() - startedAt, ...outcome });
      } catch {
        // WHY: logging must never wedge the scheduler.
      }
    };
    const failed = (error: unknown, probe: AppCheckProbe | null): false => {
      let failure: AnonFailure;
      try {
        failure = deps.classify(error, probe);
      } catch {
        // WHY: a classifier that throws must not take the scheduler down with it.
        failure = { cls: 'transient' };
      }
      recordFailure(failure);
      report({
        result: failure.cls,
        ...(failure.acKind !== undefined && { acKind: failure.acKind }),
        ...(failure.code !== undefined && { code: failure.code }),
        ...(error !== undefined && { error }),
      });
      return false;
    };

    const end = (ok: boolean): boolean => {
      inFlight = null;
      signing = null;
      if (!ok) schedule();
      return ok;
    };

    // WHY: the guard repeats once the probe answers, so a pause() or a Google sign-in landing meanwhile
    // still wins. inFlight is always cleared, even when a dep throws, or the scheduler never retries.
    inFlight = startProbe()
      .then(
        (probe): Promise<boolean> | boolean => {
          if (pauseDepth > 0 || deps.hasUser()) return deps.hasUser();
          if (!probe.ok && probeStopsSignIn(probe.kind)) return failed(undefined, probe);
          signing = callSignIn();
          return signing.then(
            () => {
              recordSuccess();
              report({ result: 'ok', ...probeFailureOf(probe) });
              return deps.hasUser();
            },
            (error: unknown) => failed(error, probe),
          );
        },
        (error: unknown): boolean => {
          if (pauseDepth > 0 || deps.hasUser()) return deps.hasUser();
          return failed(error, null);
        },
      )
      .then(end, () => end(false));
    return inFlight;
  }

  return {
    ensure(trigger: EnsureTrigger = 'cold') {
      started = true;
      cancelTimer();
      return new Promise<boolean>((resolve) => {
        const handle = deps.setTimer(() => resolve(deps.hasUser()), deps.timeoutMs);
        void attempt(trigger).then((ok) => {
          deps.clearTimer(handle);
          resolve(ok);
        });
      });
    },

    onForeground() {
      // WHY: a device the last answer ruled out attests again only for the user.
      if (ladder === 'none' || !mayRetryNow()) return;
      cancelTimer();
      void attempt('foreground');
    },

    retryNow() {
      if (mayRetryNow()) {
        cancelTimer();
        void attempt('manual');
      }
      return ladder === 'none' ? 'unavailable' : 'connecting';
    },

    async pause() {
      pauseDepth++;
      cancelTimer();
      if (signing) await inFlight;
    },

    resume() {
      pauseDepth = Math.max(0, pauseDepth - 1);
      schedule();
    },
  };
}
