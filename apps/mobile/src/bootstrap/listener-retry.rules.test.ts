import { expect, test } from 'vitest';
import {
  createRetryingListener,
  HEALTHY_AFTER_MS,
  isResubscribable,
  RESUBSCRIBE_DELAYS_MS,
  STEADY_RESUBSCRIBE_MS,
} from './listener-retry.rules';

const denied = { code: 'firestore/permission-denied', message: 'denied' };

/** A fake onSnapshot plus a manual clock, so every listener and timer is visible. */
function harness() {
  const listeners: { next: (v: string) => void; error: (e: unknown) => void; closed: boolean }[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean; fired: boolean }[] = [];
  const delivered: string[] = [];
  const errors: unknown[] = [];
  const stop = createRetryingListener<string>({
    subscribe: (next, error) => {
      const l = { next, error, closed: false };
      listeners.push(l);
      return () => {
        l.closed = true;
      };
    },
    onNext: (v) => delivered.push(v),
    onError: (e) => errors.push(e),
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false, fired: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
  });
  const pending = (healthy: boolean) =>
    timers.filter((t) => !t.cleared && !t.fired && (t.ms === HEALTHY_AFTER_MS) === healthy);
  const fire = (healthy: boolean) => {
    const t = pending(healthy).at(-1)!;
    t.fired = true;
    t.fn();
  };
  const retryDelays = () => timers.filter((t) => t.ms !== HEALTHY_AFTER_MS).map((t) => t.ms);
  return {
    listeners,
    timers,
    delivered,
    errors,
    stop,
    pending,
    retryDelays,
    fireRetry: () => fire(false),
    fireHealthy: () => fire(true),
  };
}

test('a permission denial resubscribes on the backoff and reports once', () => {
  const h = harness();
  h.listeners[0].error(denied);
  expect(h.retryDelays()).toEqual([RESUBSCRIBE_DELAYS_MS[0]]);
  h.fireRetry();
  expect(h.listeners).toHaveLength(2);

  h.listeners[1].error(denied);
  h.fireRetry();
  h.listeners[2].error(denied);
  expect(h.retryDelays()).toEqual([...RESUBSCRIBE_DELAYS_MS.slice(0, 3)]);
  expect(h.errors).toEqual([denied]);
});

test('a resubscribe closes the listener it replaces', () => {
  const h = harness();
  h.listeners[0].error(denied);
  h.fireRetry();
  expect(h.listeners[0].closed).toBe(true);
  expect(h.listeners[1].closed).toBe(false);
});

test('the backoff settles at the steady delay', () => {
  const h = harness();
  for (let i = 0; i < RESUBSCRIBE_DELAYS_MS.length + 2; i++) {
    h.listeners.at(-1)!.error(denied);
    h.fireRetry();
  }
  expect(h.retryDelays().at(-1)).toBe(STEADY_RESUBSCRIBE_MS);
});

test('a cached delivery before each denial neither resets the backoff nor reports again', () => {
  const h = harness();
  for (let i = 0; i < 4; i++) {
    h.listeners.at(-1)!.next('cached');
    h.listeners.at(-1)!.error(denied);
    h.fireRetry();
  }
  expect(h.retryDelays()).toEqual([...RESUBSCRIBE_DELAYS_MS.slice(0, 4)]);
  expect(h.errors).toEqual([denied]);
  expect(h.delivered).toEqual(['cached', 'cached', 'cached', 'cached']);
});

test('a listener that stays up resets the backoff and re-arms the report', () => {
  const h = harness();
  h.listeners[0].error(denied);
  h.fireRetry();
  h.listeners[1].next('prefs');
  h.fireHealthy();
  h.listeners[1].error(denied);
  expect(h.retryDelays()).toEqual([RESUBSCRIBE_DELAYS_MS[0], RESUBSCRIBE_DELAYS_MS[0]]);
  expect(h.errors).toHaveLength(2);
});

test('a healthy listener runs no timer', () => {
  const h = harness();
  h.listeners[0].next('a');
  h.listeners[0].next('b');
  expect(h.timers).toHaveLength(0);
});

test('any other error ends the listener, as before', () => {
  const h = harness();
  const other = { code: 'firestore/failed-precondition' };
  h.listeners[0].error(other);
  expect(h.timers).toHaveLength(0);
  expect(h.errors).toEqual([other]);
});

test('stopping closes the listener and cancels every pending timer', () => {
  const h = harness();
  h.listeners[0].error(denied);
  h.fireRetry();
  h.listeners[1].next('cached');
  h.listeners[1].error(denied);
  h.listeners[1].next('late');
  h.stop();
  expect(h.pending(false)).toHaveLength(0);
  expect(h.pending(true)).toHaveLength(0);
  expect(h.listeners[1].closed).toBe(true);
});

test('a stopped listener delivers nothing', () => {
  const h = harness();
  h.stop();
  h.listeners[0].next('late');
  h.listeners[0].error(denied);
  expect(h.delivered).toEqual([]);
  expect(h.errors).toEqual([]);
  expect(h.timers).toHaveLength(0);
});

test('only a denial or a missing credential is resubscribable', () => {
  expect(isResubscribable(denied)).toBe(true);
  expect(isResubscribable({ code: 'firestore/unauthenticated' })).toBe(true);
  expect(isResubscribable({ code: 'firestore/not-found' })).toBe(false);
  expect(isResubscribable(new Error('x'))).toBe(false);
  expect(isResubscribable(null)).toBe(false);
});
