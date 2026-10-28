/**
 * QUIRK(firebase): a Firestore listener ends on its first error.
 * EVIDENCE: in 3.6.2 one App Check 403 left every listener in the session dead until the next cold start.
 */
export const RESUBSCRIBE_DELAYS_MS = [5_000, 30_000, 120_000, 300_000] as const;
export const STEADY_RESUBSCRIBE_MS = 600_000;
/**
 * QUIRK(firebase): `onSnapshot` delivers a cached copy before the server's denial, so resetting on first
 * delivery turned the backoff into a 5 s loop that reported every cycle.
 */
export const HEALTHY_AFTER_MS = 60_000;

const RESUBSCRIBABLE_CODES = new Set(['firestore/permission-denied', 'firestore/unauthenticated']);

export function isResubscribable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  return RESUBSCRIBABLE_CODES.has(String((err as { code: unknown }).code));
}

export function resubscribeDelay(retryIndex: number): number {
  return RESUBSCRIBE_DELAYS_MS[retryIndex] ?? STEADY_RESUBSCRIBE_MS;
}

export interface RetryingListenerDeps<T> {
  subscribe: (onNext: (value: T) => void, onError: (err: unknown) => void) => () => void;
  onNext: (value: T) => void;
  // WHY: only an episode's first error, so a device behind the SDK's hours-long App Check backoff logs once.
  onError: (err: unknown) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export function createRetryingListener<T>(deps: RetryingListenerDeps<T>): () => void {
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  let retryTimer: unknown = null;
  let healthyTimer: unknown = null;
  let retryIndex = 0;
  let reported = false;

  function clearHealthyTimer() {
    if (healthyTimer !== null) {
      deps.clearTimer(healthyTimer);
      healthyTimer = null;
    }
  }

  function start() {
    unsubscribe = deps.subscribe(
      (value) => {
        if (stopped) return;
        if (healthyTimer === null && (retryIndex > 0 || reported)) {
          healthyTimer = deps.setTimer(() => {
            healthyTimer = null;
            retryIndex = 0;
            reported = false;
          }, HEALTHY_AFTER_MS);
        }
        deps.onNext(value);
      },
      (err) => {
        if (stopped) return;
        clearHealthyTimer();
        if (!reported) {
          reported = true;
          deps.onError(err);
        }
        if (!isResubscribable(err) || retryTimer !== null) return;
        retryTimer = deps.setTimer(() => {
          retryTimer = null;
          if (stopped) return;
          retryIndex++;
          // QUIRK(react-native-firebase): the JS emitter subscription outlives the errored native listener until unsubscribe.
          unsubscribe?.();
          unsubscribe = null;
          start();
        }, resubscribeDelay(retryIndex));
      },
    );
  }

  start();
  return () => {
    stopped = true;
    if (retryTimer !== null) {
      deps.clearTimer(retryTimer);
      retryTimer = null;
    }
    clearHealthyTimer();
    unsubscribe?.();
    unsubscribe = null;
  };
}
