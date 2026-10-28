/**
 * QUIRK(react-native-firebase): neither platform hands JS anything but the native message, so a
 * failure is read off it.
 */
export type AppCheckFailureKind = 'network' | 'throttled' | 'backoff' | 'rejected' | 'unsupported' | 'other';

export interface AppCheckFailure {
  kind: AppCheckFailureKind;
  code?: string;
}

/**
 * QUIRK(play-integrity): its `IntegrityErrorCode` values as of 1.4.0; a code outside them is not Play
 * Integrity's, since iOS prints NSURLError codes the same way ("code: -999").
 */
const INTEGRITY_KIND: Record<string, AppCheckFailureKind> = {
  '-1': 'unsupported',
  '-2': 'unsupported',
  '-3': 'network',
  '-4': 'unsupported',
  '-5': 'other',
  '-6': 'unsupported',
  '-7': 'other',
  '-8': 'throttled',
  '-9': 'unsupported',
  '-10': 'other',
  '-11': 'other',
  '-12': 'network',
  '-13': 'other',
  '-14': 'unsupported',
  '-15': 'unsupported',
  '-16': 'other',
  '-17': 'network',
  '-100': 'other',
};

/** QUIRK(app-check-core): the DCError descriptions `GACAppCheckErrorUtil` writes for App Attest. */
const DC_ERROR_KIND: [RegExp, AppCheckFailureKind][] = [
  [/DCErrorFeatureUnsupported/, 'unsupported'],
  [/DCErrorServerUnavailable/, 'network'],
  [/DCErrorInvalidKey/, 'rejected'],
];

// QUIRK(firebase): iOS says "Too many attempts. Underlying error: …", Android "Too many attempts.".
const BACKOFF = /Too many attempts/;
// QUIRK(firebase): iOS says "HTTP status code: 403", Android "Error returned from API. code: 403 body: …".
const HTTP_STATUS = /\bcode:\s?(\d{3})\b/;
// QUIRK(play-integrity): "-3: Network error…", "IntegrityServiceException: -14: …", "Integrity API error (-14)".
const INTEGRITY_CODE = /(?:^|[\s:(])(-\d{1,3})(?=[\s:)])/g;
// QUIRK(app-check-core): its ServerUnreachable says "API request error.".
const NETWORK_TEXT =
  /API request error|UnknownHost|Unable to resolve host|NoRouteToHost|SocketException|SocketTimeout|ConnectException|InterruptedIOException|timed out|timeout|Connection reset|connection abort|end of stream|Failed to connect/i;
const UNSUPPORTED_TEXT = /not supported on current platform/i;

function httpKind(status: string): AppCheckFailureKind {
  if (status === '403') return 'rejected';
  if (status === '429') return 'throttled';
  if (status.startsWith('5')) return 'network';
  return 'other';
}

function integrityCode(message: string): string | undefined {
  for (const match of message.matchAll(INTEGRITY_CODE)) {
    if (match[1] in INTEGRITY_KIND) return match[1];
  }
  return undefined;
}

export function classifyAppCheckError(error: unknown): AppCheckFailure {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const http = HTTP_STATUS.exec(message)?.[1];

  if (BACKOFF.test(message)) return http ? { kind: 'backoff', code: http } : { kind: 'backoff' };
  if (http) return { kind: httpKind(http), code: http };

  const integrity = integrityCode(message);
  if (integrity) return { kind: INTEGRITY_KIND[integrity], code: integrity };

  for (const [pattern, kind] of DC_ERROR_KIND) {
    if (pattern.test(message)) return { kind };
  }
  if (NETWORK_TEXT.test(message)) return { kind: 'network' };
  if (UNSUPPORTED_TEXT.test(message)) return { kind: 'unsupported' };
  return { kind: 'other' };
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeBase64Url(input: string): string | null {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const char of input.replace(/=+$/, '')) {
    const index = BASE64URL.indexOf(char);
    if (index < 0) return null;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

export interface TokenLifetime {
  issuedAtMs: number;
  expiresAtMs: number;
}

/**
 * WHY: the TTL is set per provider in the Firebase console, so it is read off the token, not assumed;
 * decoded by hand rather than with `atob`, which the app does not otherwise rely on.
 */
export function tokenLifetime(token: string): TokenLifetime | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  const json = decodeBase64Url(payload);
  if (json === null) return null;
  let claims: { iat?: unknown; exp?: unknown };
  try {
    claims = JSON.parse(json) as { iat?: unknown; exp?: unknown };
  } catch {
    return null;
  }
  const { iat, exp } = claims;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= iat) return null;
  return { issuedAtMs: iat * 1000, expiresAtMs: exp * 1000 };
}

/**
 * WHY: age counts from `iat` capped at when the phone first held the token, so a clock running behind
 * cannot put the refresh off; a forced token counts from arrival, so a clock running ahead cannot spend it.
 */
export interface HeldToken extends TokenLifetime {
  heldSinceMs: number;
}

export interface RefreshClock {
  held: HeldToken | null;
  lastForcedAtMs: number;
}

export const INITIAL_REFRESH_CLOCK: RefreshClock = { held: null, lastForcedAtMs: 0 };

export const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60_000;

/**
 * WHY: a token issued before the held one is a slow answer (one write's lookup outlasting another's
 * forced refresh), so it changes nothing.
 */
export function observeToken(clock: RefreshClock, token: string, nowMs: number, forced: boolean): RefreshClock {
  const lastForcedAtMs = forced ? nowMs : clock.lastForcedAtMs;
  const lifetime = tokenLifetime(token);
  if (!lifetime) return { held: null, lastForcedAtMs };

  const { held } = clock;
  if (!forced && held && lifetime.issuedAtMs < held.issuedAtMs) return clock;
  const same = held !== null && held.issuedAtMs === lifetime.issuedAtMs && held.expiresAtMs === lifetime.expiresAtMs;
  const heldSinceMs = forced ? nowMs : same ? held.heldSinceMs : Math.min(lifetime.issuedAtMs, nowMs);
  return { held: { ...lifetime, heldSinceMs }, lastForcedAtMs };
}

/**
 * QUIRK(firebase): half the lifetime is just ahead of the SDK's own refresh (half the TTL plus five
 * minutes), which Android never schedules for a token kept from an earlier session (firebase-android-sdk#5235).
 */
export function shouldForceRefresh(clock: RefreshClock, nowMs: number): boolean {
  const { held } = clock;
  if (!held) return nowMs - clock.lastForcedAtMs >= FALLBACK_REFRESH_INTERVAL_MS;
  return nowMs - held.heldSinceMs > (held.expiresAtMs - held.issuedAtMs) / 2;
}

/**
 * EVIDENCE: network failures were most of what 3.6.2 sent Crashlytics and say nothing about App Check;
 * a backoff repeats a failure already reported. Analytics still counts every failure.
 */
export function shouldReportAppCheckFailure(kind: AppCheckFailureKind): boolean {
  return kind !== 'network' && kind !== 'backoff';
}

export type AppCheckProbeAnswer =
  | { ok: true; ms: number }
  | { ok: false; kind: AppCheckFailureKind; code?: string; ms: number };

export type AppCheckProbe = AppCheckProbeAnswer | { ok: false; kind: 'bounded'; code?: undefined; ms: number };

/**
 * WHY: after a failure `spaced` waits out the interval for a fresh answer, while `immediate` takes the
 * last one, for a call that must never keep the user waiting.
 */
export type ProbeMode = 'spaced' | 'immediate';

export const PROBE_TIMEOUT_MS = 3_000;

/**
 * EVIDENCE: a request with no valid token attests, and Play Integrity caps attestations per app instance
 * at about 5 a minute.
 */
export const PROBE_MIN_INTERVAL_MS = 15_000;

export interface AppCheckProbeDeps {
  getToken: () => Promise<unknown>;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  timeoutMs: number;
  minIntervalMs: number;
  onOutcome: (probe: AppCheckProbe, error: unknown) => void;
}

interface Exchange {
  startedAt: number;
  answered: Promise<AppCheckProbeAnswer>;
}

/**
 * WHY: one exchange at a time; a probe while one runs joins it under a fresh bound, so a bound that wins
 * arms no interval and drops no answer. SEE: docs/explanation/app-check.md ("Start-up order")
 */
export function createAppCheckProbe(deps: AppCheckProbeDeps): (mode?: ProbeMode) => Promise<AppCheckProbe> {
  let exchange: Exchange | null = null;
  let last: { startedAt: number; answer: AppCheckProbeAnswer } | null = null;
  let waiting: Promise<AppCheckProbe> | null = null;

  const report = (probe: AppCheckProbe, error: unknown) => {
    try {
      deps.onOutcome(probe, error);
    } catch {
      // WHY: logging must never wedge a sign-in.
    }
  };

  function ask(): Exchange {
    const startedAt = deps.now();
    const next: Exchange = {
      startedAt,
      answered: Promise.resolve()
        .then(() => deps.getToken())
        .then(
          (): [AppCheckProbeAnswer, unknown] => [{ ok: true, ms: deps.now() - startedAt }, undefined],
          (error: unknown): [AppCheckProbeAnswer, unknown] => {
            const { kind, code } = classifyAppCheckError(error);
            return [{ ok: false, kind, ...(code !== undefined && { code }), ms: deps.now() - startedAt }, error];
          },
        )
        .then(([answer, error]) => {
          if (exchange === next) exchange = null;
          last = { startedAt, answer };
          report(answer, error);
          return answer;
        }),
    };
    exchange = next;
    return next;
  }

  function bound(current: Exchange): Promise<AppCheckProbe> {
    const startedAt = deps.now();
    return new Promise<AppCheckProbe>((resolve) => {
      let settled = false;
      const timer = deps.setTimer(() => {
        if (settled) return;
        settled = true;
        const probe: AppCheckProbe = { ok: false, kind: 'bounded', ms: deps.now() - startedAt };
        report(probe, undefined);
        resolve(probe);
      }, deps.timeoutMs);
      void current.answered.then((answer) => {
        if (settled) return;
        settled = true;
        deps.clearTimer(timer);
        resolve(answer);
      });
    });
  }

  return (mode: ProbeMode = 'spaced') => {
    if (exchange) return bound(exchange);
    const waitMs = last ? last.startedAt + deps.minIntervalMs - deps.now() : 0;
    if (last && waitMs > 0) {
      if (last.answer.ok || mode === 'immediate') return Promise.resolve(last.answer);
      if (!waiting) {
        waiting = new Promise<void>((resolve) => deps.setTimer(resolve, waitMs)).then(() => {
          waiting = null;
          return bound(exchange ?? ask());
        });
      }
      return waiting;
    }
    return bound(ask());
  };
}
