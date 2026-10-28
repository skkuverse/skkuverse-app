import { describe, expect, test } from 'vitest';
import {
  classifyAppCheckError,
  createAppCheckProbe,
  FALLBACK_REFRESH_INTERVAL_MS,
  INITIAL_REFRESH_CLOCK,
  observeToken,
  PROBE_MIN_INTERVAL_MS,
  PROBE_TIMEOUT_MS,
  shouldForceRefresh,
  shouldReportAppCheckFailure,
  tokenLifetime,
  type AppCheckProbe,
} from './app-check.rules';

// The messages are the ones 3.6.2 sent to Crashlytics (2026-10), as RNFB
// rejects them: `[appCheck/token-error] ` plus the native message.
const err = (message: string) => new Error(`[appCheck/token-error] ${message}`);

test('an unreachable server is network, on either platform', () => {
  expect(classifyAppCheckError(err('작업을 완료할 수 없습니다. API request error.'))).toEqual({
    kind: 'network',
  });
  expect(
    classifyAppCheckError(
      err('java.net.UnknownHostException: Unable to resolve host "firebaseappcheck.googleapis.com": No address associated with hostname'),
    ),
  ).toEqual({ kind: 'network' });
  expect(classifyAppCheckError(err('java.net.SocketException: Software caused connection abort'))).toEqual({
    kind: 'network',
  });
  expect(classifyAppCheckError(err('java.net.SocketException: Connection reset'))).toEqual({ kind: 'network' });
  expect(classifyAppCheckError(err('unexpected end of stream on com.android.okhttp.Address@1'))).toEqual({
    kind: 'network',
  });
  expect(classifyAppCheckError(err('java.net.NoRouteToHostException: No route to host'))).toEqual({ kind: 'network' });
  expect(classifyAppCheckError(err('java.io.InterruptedIOException: timeout'))).toEqual({ kind: 'network' });
});

test('a transient Play Integrity code is network, and carries the code', () => {
  expect(classifyAppCheckError(err('-3: Network error: unable to obtain integrity details.'))).toEqual({
    kind: 'network',
    code: '-3',
  });
  expect(classifyAppCheckError(err('-17: Client transient error.'))).toEqual({ kind: 'network', code: '-17' });
  expect(classifyAppCheckError(err('-12: Unknown internal Google server error.'))).toEqual({
    kind: 'network',
    code: '-12',
  });
});

test('a 503 from the exchange is network, a 403 is a rejected attestation', () => {
  const exchange = (status: number, body: string) =>
    err(
      'The operation couldn’t be completed. The server responded with an error: - URL: https://firebaseappcheck.googleapis.com/v1/projects/p/apps/a:exchangeAppAttestAssertion' +
        ` - HTTP status code: ${status} - Response body: ${body}`,
    );
  expect(classifyAppCheckError(exchange(503, '{"error":{"code":503,"status":"UNAVAILABLE"}}'))).toEqual({
    kind: 'network',
    code: '503',
  });
  expect(
    classifyAppCheckError(exchange(403, '{"error":{"code":403,"message":"App attestation failed.","status":"PERMISSION_DENIED"}}')),
  ).toEqual({ kind: 'rejected', code: '403' });
  expect(
    classifyAppCheckError(err('com.google.firebase.FirebaseException: Error returned from API. code: 403 body: App attestation failed.')),
  ).toEqual({ kind: 'rejected', code: '403' });
});

test('a device without a working Play Store or App Attest is unsupported', () => {
  expect(
    classifyAppCheckError(
      err('com.google.android.play.core.integrity.IntegrityServiceException: -14: Integrity API error (-14): The Play Store needs to be updated.'),
    ),
  ).toEqual({ kind: 'unsupported', code: '-14' });
  expect(classifyAppCheckError(err('-1: Integrity API is not available.'))).toEqual({
    kind: 'unsupported',
    code: '-1',
  });
  expect(classifyAppCheckError(err('-9: Binding to the service in the Play Store has failed.'))).toEqual({
    kind: 'unsupported',
    code: '-9',
  });
  expect(
    classifyAppCheckError(
      err('작업을 완료할 수 없습니다. The attestation provider AppAttestProvider is not supported on current platform and OS version.'),
    ),
  ).toEqual({ kind: 'unsupported' });
  expect(classifyAppCheckError(err('-4: No Play Store account is found on device.'))).toEqual({
    kind: 'unsupported',
    code: '-4',
  });
});

// AppCheckCore's App Attest failures name the DCError (GACAppCheckErrorUtil).
const appAttest = (dcError: string) =>
  err(
    'The operation couldn’t be completed. Failed to generate a new cryptographic key for use with the App Attest service (`generateKeyWithCompletionHandler:`); ' +
      `${dcError}.`,
  );

test('an App Attest failure is sorted by its DCError', () => {
  expect(classifyAppCheckError(appAttest('DCErrorFeatureUnsupported - DeviceCheck is unavailable on this device'))).toEqual({
    kind: 'unsupported',
  });
  expect(
    classifyAppCheckError(appAttest('DCErrorServerUnavailable - An error that indicates a failed attempt to contact the App Attest service during an attestation')),
  ).toEqual({ kind: 'network' });
  expect(classifyAppCheckError(appAttest('DCErrorInvalidKey - An error caused by a failed attempt to use the App Attest key'))).toEqual({
    kind: 'rejected',
  });
  expect(
    classifyAppCheckError(appAttest('DCErrorUnknownSystemFailure - A failure has occurred, such as the failure to generate a token')),
  ).toEqual({ kind: 'other' });
});

test('an NSURLError code is not read as a Play Integrity code', () => {
  expect(
    classifyAppCheckError(appAttest('Unknown Error { domain: NSURLErrorDomain, code: -999 } - cancelled')),
  ).toEqual({ kind: 'other' });
});

test('a quota is throttled, on either platform', () => {
  expect(
    classifyAppCheckError(err('com.google.android.play.core.integrity.IntegrityServiceException: -8: The calling app is making too many requests to the API.')),
  ).toEqual({ kind: 'throttled', code: '-8' });
  expect(classifyAppCheckError(err('com.google.firebase.FirebaseException: Error returned from API. code: 429 body: Too Many Requests'))).toEqual({
    kind: 'throttled',
    code: '429',
  });
});

test('the SDK backing off is backoff, with the failure behind it when iOS names it', () => {
  expect(classifyAppCheckError(err('com.google.firebase.FirebaseException: Too many attempts.'))).toEqual({
    kind: 'backoff',
  });
  expect(
    classifyAppCheckError(
      err(
        'The operation couldn’t be completed. Too many attempts. Underlying error: The operation couldn’t be completed. The server responded with an error: - URL: https://firebaseappcheck.googleapis.com/v1/projects/p/apps/a:exchangeAppAttestAssertion - HTTP status code: 403 - Response body: {}',
      ),
    ),
  ).toEqual({ kind: 'backoff', code: '403' });
});

test('a misconfigured project is other, not a device problem', () => {
  expect(classifyAppCheckError(err('-16: Cloud project number is invalid.'))).toEqual({ kind: 'other', code: '-16' });
});

test('anything else is other, including a non-Error rejection', () => {
  expect(classifyAppCheckError(new Error('[appCheck/provider-not-ready] provider not ready'))).toEqual({
    kind: 'other',
  });
  expect(classifyAppCheckError(err('-100: Unknown error processing integrity request.'))).toEqual({
    kind: 'other',
    code: '-100',
  });
  expect(classifyAppCheckError('boom')).toEqual({ kind: 'other' });
  expect(classifyAppCheckError(undefined)).toEqual({ kind: 'other' });
});

test('only a network failure or a backoff stays out of Crashlytics', () => {
  expect(shouldReportAppCheckFailure('network')).toBe(false);
  expect(shouldReportAppCheckFailure('backoff')).toBe(false);
  expect(shouldReportAppCheckFailure('throttled')).toBe(true);
  expect(shouldReportAppCheckFailure('rejected')).toBe(true);
  expect(shouldReportAppCheckFailure('unsupported')).toBe(true);
  expect(shouldReportAppCheckFailure('other')).toBe(true);
});

const jwt = (payload: object) =>
  [
    'eyJhbGciOiJSUzI1NiJ9',
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'c2lnbmF0dXJl',
  ].join('.');

const HOUR = 3_600_000;
const MINUTE = 60_000;
/** A token issued at `iatMs` that lives `ttlMs`, in whole seconds as the exchange writes them. */
const tokenAt = (iatMs: number, ttlMs: number) => jwt({ sub: '1:0:android:0', iat: iatMs / 1000, exp: (iatMs + ttlMs) / 1000 });
const T0 = 1_761_134_400_000;
/** The clock right after a launch whose first token is `token`, read at `nowMs`. */
const launched = (token: string, nowMs: number) => observeToken(INITIAL_REFRESH_CLOCK, token, nowMs, false);

test("a token's lifetime is its iat and exp", () => {
  expect(tokenLifetime(jwt({ sub: '1:0:ios:0', iat: 1761134400, exp: 1761138000 }))).toEqual({
    issuedAtMs: 1761134400_000,
    expiresAtMs: 1761138000_000,
  });
  // Payload lengths that need one and two padding characters.
  expect(tokenLifetime(jwt({ iat: 1, exp: 2 }))).toEqual({ issuedAtMs: 1000, expiresAtMs: 2000 });
  expect(tokenLifetime(jwt({ iat: 12, exp: 13, a: 'xyz' }))).toEqual({ issuedAtMs: 12_000, expiresAtMs: 13_000 });
});

test('a token without a readable iat and exp has no lifetime', () => {
  expect(tokenLifetime('not-a-jwt')).toBeNull();
  expect(tokenLifetime('a.!!!.c')).toBeNull();
  expect(tokenLifetime(jwt({ exp: 1 }))).toBeNull();
  expect(tokenLifetime(jwt({ iat: 1 }))).toBeNull();
  expect(tokenLifetime(jwt({ iat: '1', exp: 2 }))).toBeNull();
  expect(tokenLifetime(jwt({ iat: 2, exp: 2 }))).toBeNull();
  expect(tokenLifetime(jwt({ iat: 3, exp: 2 }))).toBeNull();
  expect(tokenLifetime(`a.${Buffer.from('{not json').toString('base64url')}.c`)).toBeNull();
});

test('a fresh token is not refreshed', () => {
  const clock = launched(tokenAt(T0, HOUR), T0);
  expect(shouldForceRefresh(clock, T0)).toBe(false);
  expect(shouldForceRefresh(clock, T0 + 6 * MINUTE)).toBe(false);
});

test('a token is refreshed once less than half its lifetime is left', () => {
  const token = tokenAt(T0, HOUR);
  // 51% left, then 49% left.
  expect(shouldForceRefresh(launched(token, T0 + 0.49 * HOUR), T0 + 0.49 * HOUR)).toBe(false);
  expect(shouldForceRefresh(launched(token, T0 + 0.51 * HOUR), T0 + 0.51 * HOUR)).toBe(true);
  // The same token, held since launch.
  const clock = launched(token, T0 + 10 * MINUTE);
  expect(shouldForceRefresh(observeToken(clock, token, T0 + 29 * MINUTE, false), T0 + 29 * MINUTE)).toBe(false);
  expect(shouldForceRefresh(observeToken(clock, token, T0 + 31 * MINUTE, false), T0 + 31 * MINUTE)).toBe(true);
});

test('an expired token is refreshed', () => {
  expect(shouldForceRefresh(launched(tokenAt(T0, HOUR), T0 + 2 * HOUR), T0 + 2 * HOUR)).toBe(true);
});

test('the half is taken from the token, so a longer TTL refreshes later', () => {
  const twelve = tokenAt(T0, 12 * HOUR);
  expect(shouldForceRefresh(launched(twelve, T0 + 5.9 * HOUR), T0 + 5.9 * HOUR)).toBe(false);
  expect(shouldForceRefresh(launched(twelve, T0 + 6.1 * HOUR), T0 + 6.1 * HOUR)).toBe(true);
  const day = tokenAt(T0, 24 * HOUR);
  expect(shouldForceRefresh(launched(day, T0 + 11.9 * HOUR), T0 + 11.9 * HOUR)).toBe(false);
  expect(shouldForceRefresh(launched(day, T0 + 12.1 * HOUR), T0 + 12.1 * HOUR)).toBe(true);
});

test('a forced refresh dates the new token from the moment it arrived', () => {
  const stale = launched(tokenAt(T0, HOUR), T0 + 40 * MINUTE);
  // The phone clock runs an hour ahead, so the new token already reads as half spent.
  const now = T0 + 2 * HOUR;
  const forced = observeToken(stale, tokenAt(T0 + HOUR, HOUR), now, true);
  expect(shouldForceRefresh(forced, now + MINUTE)).toBe(false);
  expect(shouldForceRefresh(forced, now + 29 * MINUTE)).toBe(false);
  expect(shouldForceRefresh(forced, now + 31 * MINUTE)).toBe(true);
});

test('a token from a clock ahead of the phone is dated from when the phone first held it', () => {
  // Issued an hour in the phone's future: its age counts from launch, not from never.
  const token = tokenAt(T0 + HOUR, HOUR);
  const clock = launched(token, T0);
  expect(shouldForceRefresh(observeToken(clock, token, T0 + 29 * MINUTE, false), T0 + 29 * MINUTE)).toBe(false);
  expect(shouldForceRefresh(observeToken(clock, token, T0 + 31 * MINUTE, false), T0 + 31 * MINUTE)).toBe(true);
});

test('a token the SDK refreshed on its own is held from its iat', () => {
  const clock = launched(tokenAt(T0, HOUR), T0 + 10 * MINUTE);
  const renewed = observeToken(clock, tokenAt(T0 + 35 * MINUTE, HOUR), T0 + 36 * MINUTE, false);
  expect(shouldForceRefresh(renewed, T0 + 36 * MINUTE)).toBe(false);
  expect(shouldForceRefresh(renewed, T0 + 66 * MINUTE)).toBe(true);
});

test('a token older than the one held never moves the clock back', () => {
  const forced = observeToken(INITIAL_REFRESH_CLOCK, tokenAt(T0 + 40 * MINUTE, HOUR), T0 + 40 * MINUTE, true);
  // One write's lookup lands after another write forced a newer token.
  const late = observeToken(forced, tokenAt(T0, HOUR), T0 + 41 * MINUTE, false);
  expect(late).toEqual(forced);
  expect(shouldForceRefresh(late, T0 + 41 * MINUTE)).toBe(false);
});

test('without a readable lifetime, a refresh is forced at most once per fallback interval', () => {
  // No token at launch: the first write refreshes.
  expect(shouldForceRefresh(INITIAL_REFRESH_CLOCK, T0)).toBe(true);
  expect(shouldForceRefresh(launched('not-a-jwt', T0), T0)).toBe(true);
  const forced = observeToken(INITIAL_REFRESH_CLOCK, 'not-a-jwt', T0, true);
  expect(shouldForceRefresh(forced, T0 + FALLBACK_REFRESH_INTERVAL_MS - 1)).toBe(false);
  expect(shouldForceRefresh(forced, T0 + FALLBACK_REFRESH_INTERVAL_MS)).toBe(true);
  // A token that stops parsing drops what was held.
  const held = observeToken(INITIAL_REFRESH_CLOCK, tokenAt(T0, HOUR), T0, true);
  expect(shouldForceRefresh(observeToken(held, 'a.!!!.c', T0 + 6 * MINUTE, false), T0 + 6 * MINUTE)).toBe(true);
});

type Timer = { id: number; fn: () => void; ms: number };

/** Manual clock and timers; each getToken call takes the next queued answer, or hangs until settled by hand. */
function probeHarness() {
  const timers: Timer[] = [];
  let nextId = 1;
  let now = 1_000_000;
  let calls = 0;
  const outcomes: ('ok' | { fail: string })[] = [];
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  const reported: { probe: AppCheckProbe; error: unknown }[] = [];
  const probe = createAppCheckProbe({
    getToken: () => {
      calls++;
      const next = outcomes.shift();
      if (next === 'ok') return Promise.resolve({ token: 't' });
      if (next) return Promise.reject(new Error(`[appCheck/token-error] ${next.fail}`));
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    },
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
    timeoutMs: PROBE_TIMEOUT_MS,
    minIntervalMs: PROBE_MIN_INTERVAL_MS,
    onOutcome: (p, error) => reported.push({ probe: p, error }),
  });
  return {
    probe,
    timers,
    outcomes,
    pending,
    reported,
    get calls() {
      return calls;
    },
    advance: (ms: number) => {
      now += ms;
    },
    /** Fire the oldest timer, moving the clock to it. */
    fire: () => {
      const t = timers.shift();
      expect(t, 'expected a timer').toBeTruthy();
      now += t!.ms;
      t!.fn();
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('createAppCheckProbe', () => {
  test('a token within the timeout is ok, with how long it took, and the timer is cleared', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push('ok');
    // Act
    const result = await h.probe();
    // Assert
    expect(result).toEqual({ ok: true, ms: 0 });
    expect(h.timers.length).toBe(0);
    expect(h.reported).toEqual([{ probe: result, error: undefined }]);
  });

  test('a rejection is sorted by its message, with the code it carried', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push({ fail: 'com.google.android.play.core.integrity.IntegrityServiceException: -8: too many requests' });
    // Act
    const result = await h.probe();
    // Assert
    expect(result).toEqual({ ok: false, kind: 'throttled', code: '-8', ms: 0 });
    expect(h.reported[0]?.error).toBeInstanceOf(Error);
  });

  test('the timer winning is bounded, and the late answer is reported when it arrives', async () => {
    // Arrange
    const h = probeHarness();
    const probing = h.probe();
    await flush();
    expect(h.timers[0]?.ms).toBe(PROBE_TIMEOUT_MS);
    // Act
    h.fire();
    const result = await probing;
    h.advance(1_000);
    h.pending[0]!.resolve();
    await flush();
    // Assert
    expect(result).toEqual({ ok: false, kind: 'bounded', ms: PROBE_TIMEOUT_MS });
    expect(h.reported.map((r) => r.probe)).toEqual([result, { ok: true, ms: PROBE_TIMEOUT_MS + 1_000 }]);
  });

  test('after a bound wins, the next probe joins the running exchange under a fresh bound, with no interval to wait', async () => {
    // Arrange
    const h = probeHarness();
    const first = h.probe();
    await flush();
    h.fire();
    expect((await first).ok).toBe(false);
    h.advance(1_000);
    // Act
    const second = h.probe();
    await flush();
    // Assert
    expect(h.calls, 'no second request').toBe(1);
    expect(h.timers.map((t) => t.ms), 'a fresh bound, not the interval').toEqual([PROBE_TIMEOUT_MS]);
    h.pending[0]!.resolve();
    expect(await second).toEqual({ ok: true, ms: PROBE_TIMEOUT_MS + 1_000 });
    expect(h.timers.length, 'the bound is cleared').toBe(0);
    expect(await h.probe(), 'within the interval the answer stands').toEqual({ ok: true, ms: PROBE_TIMEOUT_MS + 1_000 });
    expect(h.calls).toBe(1);
  });

  test('a failure that arrives after a bound counts the interval from when the SDK was asked', async () => {
    // Arrange
    const h = probeHarness();
    const first = h.probe();
    await flush();
    h.fire();
    await first;
    h.advance(1_000);
    h.pending[0]!.reject(new Error('[appCheck/token-error] API request error.'));
    await flush();
    h.advance(1_000);
    // Act
    const retried = h.probe();
    await flush();
    // Assert
    expect(h.calls).toBe(1);
    expect(h.timers.map((t) => t.ms)).toEqual([PROBE_MIN_INTERVAL_MS - PROBE_TIMEOUT_MS - 2_000]);
    h.outcomes.push('ok');
    h.fire();
    expect(await retried).toEqual({ ok: true, ms: 0 });
    expect(h.calls).toBe(2);
  });

  test('every bound that wins is reported, and the answer once', async () => {
    // Arrange
    const h = probeHarness();
    const a = h.probe();
    await flush();
    h.fire();
    await a;
    const b = h.probe();
    await flush();
    h.fire();
    await b;
    // Act
    h.pending[0]!.resolve();
    await flush();
    // Assert
    expect(h.reported.map((r) => (r.probe.ok ? 'ok' : r.probe.kind))).toEqual(['bounded', 'bounded', 'ok']);
    expect(h.calls).toBe(1);
  });

  test('an immediate probe takes a failure within the interval as its answer, where a spaced one waits', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push({ fail: 'com.google.android.play.core.integrity.IntegrityServiceException: -8: too many requests' });
    const failure = await h.probe();
    h.advance(5_000);
    // Act
    const now = await h.probe('immediate');
    // Assert
    expect(now).toBe(failure);
    expect(h.calls).toBe(1);
    expect(h.timers.length, 'nothing armed').toBe(0);
    const spaced = h.probe('spaced');
    await flush();
    expect(h.timers.map((t) => t.ms)).toEqual([PROBE_MIN_INTERVAL_MS - 5_000]);
    h.outcomes.push('ok');
    h.fire();
    expect((await spaced).ok).toBe(true);
  });

  test('an immediate probe asks past the interval, and joins an exchange in flight under its own bound', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push({ fail: 'API request error.' });
    await h.probe();
    h.advance(PROBE_MIN_INTERVAL_MS);
    // Act
    const asked = h.probe('immediate');
    await flush();
    const joined = h.probe('immediate');
    await flush();
    // Assert
    expect(h.calls).toBe(2);
    expect(h.timers.map((t) => t.ms)).toEqual([PROBE_TIMEOUT_MS, PROBE_TIMEOUT_MS]);
    h.pending[0]!.resolve();
    expect(await asked).toEqual({ ok: true, ms: 0 });
    expect(await joined).toBe(await asked);
    expect(h.timers.length).toBe(0);
  });

  test('within the interval an ok is answered again without a request', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push('ok');
    const first = await h.probe();
    h.advance(PROBE_MIN_INTERVAL_MS - 1);
    // Act
    const second = await h.probe();
    // Assert
    expect(second).toBe(first);
    expect(h.calls, 'one request').toBe(1);
    expect(h.reported.length, 'one outcome').toBe(1);
  });

  test('after a failure the next probe waits out the interval, then asks again', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push({ fail: 'API request error.' }, 'ok');
    await h.probe();
    h.advance(5_000);
    // Act
    const retried = h.probe();
    await flush();
    // Assert
    expect(h.calls, 'not yet').toBe(1);
    expect(h.timers[0]?.ms).toBe(PROBE_MIN_INTERVAL_MS - 5_000);
    h.fire();
    expect(await retried).toEqual({ ok: true, ms: 0 });
    expect(h.calls).toBe(2);
  });

  test('past the interval a probe asks at once, ok or not', async () => {
    // Arrange
    const h = probeHarness();
    h.outcomes.push('ok', 'ok');
    await h.probe();
    h.advance(PROBE_MIN_INTERVAL_MS);
    // Act
    await h.probe();
    // Assert
    expect(h.calls).toBe(2);
  });

  test('concurrent callers share one probe', async () => {
    // Arrange
    const h = probeHarness();
    // Act
    const a = h.probe();
    const b = h.probe();
    await flush();
    h.pending[0]!.resolve();
    // Assert
    expect(await a).toBe(await b);
    expect(h.calls).toBe(1);
  });

  test('a getToken that throws synchronously is a failure, never a rejection', async () => {
    // Arrange
    const probe = createAppCheckProbe({
      getToken: () => {
        throw new Error('App Check is not initialized');
      },
      now: () => 0,
      setTimer: () => 1,
      clearTimer: () => undefined,
      timeoutMs: PROBE_TIMEOUT_MS,
      minIntervalMs: PROBE_MIN_INTERVAL_MS,
      onOutcome: () => undefined,
    });
    // Act & Assert
    expect(await probe()).toEqual({ ok: false, kind: 'other', ms: 0 });
  });
});
