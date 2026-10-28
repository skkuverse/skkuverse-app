import { describe, expect, test } from 'vitest';
import type { AppCheckFailureKind, AppCheckProbe } from '@/platform/app-check.rules';
import {
  GoogleAuthError,
  appCheckSignInCode,
  classifyAnonFailure,
  classifySignInError,
  sessionReasonMessageKey,
  shouldSignInInsteadOfLink,
  signInErrorAppCheck,
  signInErrorClass,
  signInErrorCode,
  signInErrorMessageKey,
  type AnonFailure,
  type GoogleSignInErrorCode,
} from './sign-in-errors.rules';

// Android's values; the classifier compares whatever the native module hands it.
const statusCodes = {
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};
const withCode = (code: string | number, message = String(code)) => Object.assign(new Error(message), { code });

// What iOS reports for a refused App Check token under enforcement (17999).
const IOS_APP_CHECK_REFUSAL = withCode(
  'auth/internal-error',
  '[auth/internal-error] An internal error has occurred, print and inspect the error details for more information. Firebase App Check token is invalid.',
);

const probeOk: AppCheckProbe = { ok: true, ms: 12 };
const probeBounded: AppCheckProbe = { ok: false, kind: 'bounded', ms: 3_000 };
const probeFailed = (kind: AppCheckFailureKind, code?: string): AppCheckProbe => ({
  ok: false,
  kind,
  ...(code !== undefined && { code }),
  ms: 40,
});

describe('classifySignInError', () => {
  test('native statusCodes: silent, unreported', () => {
    expect(classifySignInError(withCode('12501'), statusCodes)).toStrictEqual({ code: 'CANCELLED', report: false });
    expect(classifySignInError(withCode('ASYNC_OP_IN_PROGRESS'), statusCodes)).toStrictEqual({
      code: 'IN_PROGRESS',
      report: false,
    });
    expect(classifySignInError(withCode('12502'), statusCodes)).toStrictEqual({ code: 'IN_PROGRESS', report: false });
    expect(classifySignInError(withCode('PLAY_SERVICES_NOT_AVAILABLE'), statusCodes)).toStrictEqual({
      code: 'PLAY_SERVICES_UNAVAILABLE',
      report: false,
    });
  });

  test('Google network codes on both platforms are NETWORK, unreported', () => {
    for (const code of ['7', '-1009', '-1001', '-1005']) {
      expect(classifySignInError(withCode(code), statusCodes), code).toStrictEqual({ code: 'NETWORK', report: false });
    }
  });

  test('a numeric code is compared as its string', () => {
    expect(classifySignInError(withCode(7), statusCodes).code).toBe('NETWORK');
  });

  test('Firebase auth codes', () => {
    const cases: [string, GoogleSignInErrorCode, boolean][] = [
      ['auth/network-request-failed', 'NETWORK', false],
      ['auth/too-many-requests', 'TOO_MANY_REQUESTS', true],
      ['auth/quota-exceeded', 'TOO_MANY_REQUESTS', true],
      ['auth/user-disabled', 'ACCOUNT_UNAVAILABLE', true],
      ['auth/account-exists-with-different-credential', 'ACCOUNT_UNAVAILABLE', true],
    ];
    for (const [raw, code, report] of cases) {
      expect(classifySignInError(withCode(raw), statusCodes), raw).toStrictEqual({ code, report });
    }
  });

  test('DEVELOPER_ERROR and anything unrecognised are UNKNOWN and reported', () => {
    expect(classifySignInError(withCode('10'), statusCodes)).toStrictEqual({ code: 'UNKNOWN', report: true });
    expect(classifySignInError(withCode('auth/operation-not-allowed'), statusCodes)).toStrictEqual({
      code: 'UNKNOWN',
      report: true,
    });
    expect(classifySignInError(new Error('no code'), statusCodes)).toStrictEqual({ code: 'UNKNOWN', report: true });
    expect(classifySignInError('string thrown', statusCodes)).toStrictEqual({ code: 'UNKNOWN', report: true });
    expect(classifySignInError(null, statusCodes)).toStrictEqual({ code: 'UNKNOWN', report: true });
  });

  test('a GoogleAuthError keeps its code; only UNKNOWN (missing idToken) is reported', () => {
    expect(classifySignInError(new GoogleAuthError('DOMAIN_NOT_ALLOWED'), statusCodes)).toStrictEqual({
      code: 'DOMAIN_NOT_ALLOWED',
      report: false,
    });
    expect(classifySignInError(new GoogleAuthError('UNKNOWN'), statusCodes)).toStrictEqual({
      code: 'UNKNOWN',
      report: true,
    });
  });

  test('a GoogleAuthError thrown for a failed probe carries the probe through, unreported', () => {
    // Arrange
    const thrown = new GoogleAuthError('APP_CHECK_THROTTLED', { kind: 'throttled', code: '-8' });
    // Act & Assert
    expect(classifySignInError(thrown, statusCodes, probeFailed('throttled', '-8'))).toStrictEqual({
      code: 'APP_CHECK_THROTTLED',
      report: false,
      appCheck: { kind: 'throttled', code: '-8' },
    });
  });

  test("a refused token is APP_CHECK by Firebase's code and by iOS's internal-error text, probe or not", () => {
    expect(classifySignInError(withCode('auth/firebase-app-check-token-is-invalid'), statusCodes)).toStrictEqual({
      code: 'APP_CHECK',
      report: true,
    });
    expect(classifySignInError(IOS_APP_CHECK_REFUSAL, statusCodes, probeOk)).toStrictEqual({
      code: 'APP_CHECK',
      report: true,
    });
    expect(classifySignInError(IOS_APP_CHECK_REFUSAL, statusCodes, probeFailed('rejected', '403'))).toStrictEqual({
      code: 'APP_CHECK',
      report: true,
      appCheck: { kind: 'rejected', code: '403' },
    });
  });

  test('a failed probe makes an internal-error or unknown failure App Check, by the kind', () => {
    const cases: [AppCheckProbe, GoogleSignInErrorCode, boolean][] = [
      [probeFailed('throttled', '-8'), 'APP_CHECK_THROTTLED', true],
      [probeFailed('unsupported', '-14'), 'DEVICE_UNSUPPORTED', true],
      [probeFailed('rejected', '403'), 'APP_CHECK', true],
      [probeFailed('backoff'), 'APP_CHECK', true],
      [probeFailed('other'), 'APP_CHECK', true],
      [probeFailed('network'), 'NETWORK', false],
      [probeBounded, 'NETWORK', false],
    ];
    for (const [probe, code, report] of cases) {
      const kind = probe.ok ? 'ok' : probe.kind;
      expect(classifySignInError(withCode('auth/internal-error'), statusCodes, probe), kind).toStrictEqual({
        code,
        report,
        appCheck: { kind, ...(!probe.ok && probe.code !== undefined && { code: probe.code }) },
      });
      expect(classifySignInError(withCode('auth/unknown'), statusCodes, probe).code, kind).toBe(code);
    }
  });

  test('an ok probe leaves an internal error unknown, and a cancel stays a cancel whatever the probe said', () => {
    expect(classifySignInError(withCode('auth/internal-error'), statusCodes, probeOk)).toStrictEqual({
      code: 'UNKNOWN',
      report: true,
    });
    expect(classifySignInError(withCode('12501'), statusCodes, probeFailed('rejected', '403'))).toStrictEqual({
      code: 'CANCELLED',
      report: false,
    });
  });
});

describe('appCheckSignInCode', () => {
  test('each probe kind has its code', () => {
    expect(appCheckSignInCode('network')).toBe('NETWORK');
    expect(appCheckSignInCode('bounded')).toBe('NETWORK');
    expect(appCheckSignInCode('throttled')).toBe('APP_CHECK_THROTTLED');
    expect(appCheckSignInCode('unsupported')).toBe('DEVICE_UNSUPPORTED');
    expect(appCheckSignInCode('rejected')).toBe('APP_CHECK');
    expect(appCheckSignInCode('backoff')).toBe('APP_CHECK');
    expect(appCheckSignInCode('other')).toBe('APP_CHECK');
  });
});

describe('classifyAnonFailure', () => {
  test('a failed probe is read alone: the exchange unreachable is network, the rest App Check', () => {
    const cases: [AppCheckProbe, AnonFailure][] = [
      [probeFailed('network', '-3'), { cls: 'network', acKind: 'network', code: '-3' }],
      [probeBounded, { cls: 'network', acKind: 'bounded' }],
      [probeFailed('throttled', '-8'), { cls: 'app_check', acKind: 'throttled', code: '-8' }],
      [probeFailed('backoff'), { cls: 'app_check', acKind: 'backoff' }],
      [probeFailed('rejected', '403'), { cls: 'app_check', acKind: 'rejected', code: '403' }],
      [probeFailed('unsupported', '-14'), { cls: 'app_check', acKind: 'unsupported', code: '-14' }],
      [probeFailed('other', '-16'), { cls: 'app_check', acKind: 'other', code: '-16' }],
    ];
    for (const [probe, expected] of cases) {
      expect(classifyAnonFailure(withCode('auth/internal-error'), probe)).toStrictEqual(expected);
    }
  });

  test('with an ok probe, the Auth rejection decides', () => {
    expect(classifyAnonFailure(withCode('auth/network-request-failed'), probeOk)).toStrictEqual({
      cls: 'network',
      code: 'auth/network-request-failed',
    });
    expect(classifyAnonFailure(IOS_APP_CHECK_REFUSAL, probeOk)).toStrictEqual({
      cls: 'app_check',
      code: 'auth/internal-error',
    });
    expect(classifyAnonFailure(withCode('auth/firebase-app-check-token-is-invalid'), null)).toStrictEqual({
      cls: 'app_check',
      code: 'auth/firebase-app-check-token-is-invalid',
    });
    expect(classifyAnonFailure(withCode('auth/too-many-requests'), probeOk)).toStrictEqual({
      cls: 'quota',
      code: 'auth/too-many-requests',
    });
    expect(classifyAnonFailure(withCode('auth/quota-exceeded'), probeOk).cls).toBe('quota');
    expect(classifyAnonFailure(withCode('auth/operation-not-allowed'), probeOk)).toStrictEqual({
      cls: 'fatal',
      code: 'auth/operation-not-allowed',
    });
  });

  test('an internal error with an ok probe, and anything without a code, is transient', () => {
    expect(classifyAnonFailure(withCode('auth/internal-error'), probeOk)).toStrictEqual({
      cls: 'transient',
      code: 'auth/internal-error',
    });
    expect(classifyAnonFailure(new Error('sync'), probeOk)).toStrictEqual({ cls: 'transient' });
    expect(classifyAnonFailure(undefined, null)).toStrictEqual({ cls: 'transient' });
  });
});

describe('signInErrorClass', () => {
  test('every code has a class', () => {
    const cases: Record<GoogleSignInErrorCode, ReturnType<typeof signInErrorClass>> = {
      NETWORK: 'network',
      APP_CHECK: 'app_check',
      APP_CHECK_THROTTLED: 'app_check',
      DEVICE_UNSUPPORTED: 'app_check',
      TOO_MANY_REQUESTS: 'quota',
      CANCELLED: 'user_cancel',
      IN_PROGRESS: 'user_cancel',
      DOMAIN_NOT_ALLOWED: 'fatal',
      ACCOUNT_UNAVAILABLE: 'fatal',
      PLAY_SERVICES_UNAVAILABLE: 'fatal',
      UNKNOWN: 'transient',
    };
    for (const [code, cls] of Object.entries(cases) as [GoogleSignInErrorCode, ReturnType<typeof signInErrorClass>][]) {
      expect(signInErrorClass(code), code).toBe(cls);
    }
  });
});

describe('shouldSignInInsteadOfLink', () => {
  test('the Google identity already has an account', () => {
    expect(shouldSignInInsteadOfLink(withCode('auth/credential-already-in-use'))).toBe(true);
    expect(shouldSignInInsteadOfLink(withCode('auth/email-already-in-use'))).toBe(true);
  });

  // Refusing would keep the dead anonymous user and fail every retry.
  test('the anonymous user is gone or unusable', () => {
    for (const code of ['auth/user-not-found', 'auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token']) {
      expect(shouldSignInInsteadOfLink(withCode(code)), code).toBe(true);
    }
  });

  // Falling through on these would sign a new student into a fresh uid and
  // abandon the anonymous one.
  test('a transient or unrelated link failure does not fall back', () => {
    for (const code of ['auth/network-request-failed', 'auth/too-many-requests', 'auth/internal-error']) {
      expect(shouldSignInInsteadOfLink(withCode(code)), code).toBe(false);
    }
    expect(shouldSignInInsteadOfLink(new Error('no code'))).toBe(false);
    expect(shouldSignInInsteadOfLink(undefined)).toBe(false);
  });
});

describe('signInErrorMessageKey', () => {
  test('cancel and in-progress say nothing', () => {
    expect(signInErrorMessageKey('CANCELLED', 'ios')).toBe(null);
    expect(signInErrorMessageKey('IN_PROGRESS', 'android')).toBe(null);
  });

  test('every other code has its own message', () => {
    expect(signInErrorMessageKey('DOMAIN_NOT_ALLOWED', 'ios')).toBe('auth.domainNotAllowed');
    expect(signInErrorMessageKey('PLAY_SERVICES_UNAVAILABLE', 'android')).toBe('auth.playServicesError');
    expect(signInErrorMessageKey('NETWORK', 'ios')).toBe('auth.networkError');
    expect(signInErrorMessageKey('TOO_MANY_REQUESTS', 'ios')).toBe('auth.tooManyRequests');
    expect(signInErrorMessageKey('ACCOUNT_UNAVAILABLE', 'ios')).toBe('auth.accountUnavailable');
    expect(signInErrorMessageKey('APP_CHECK', 'ios')).toBe('auth.appCheckError');
    expect(signInErrorMessageKey('APP_CHECK_THROTTLED', 'android')).toBe('auth.appCheckThrottled');
    expect(signInErrorMessageKey('UNKNOWN', 'ios')).toBe('auth.unknownError');
  });

  test('an unsupported device is told what to update on its platform', () => {
    expect(signInErrorMessageKey('DEVICE_UNSUPPORTED', 'android')).toBe('auth.deviceUnsupportedAndroid');
    expect(signInErrorMessageKey('DEVICE_UNSUPPORTED', 'ios')).toBe('auth.deviceUnsupportedIos');
  });
});

describe('signInErrorCode', () => {
  test('reads a GoogleAuthError, anything else is UNKNOWN', () => {
    expect(signInErrorCode(new GoogleAuthError('NETWORK'))).toBe('NETWORK');
    expect(signInErrorCode(new Error('boom'))).toBe('UNKNOWN');
  });
});

describe('signInErrorAppCheck', () => {
  test('reads the probe a GoogleAuthError carries, nothing otherwise', () => {
    expect(signInErrorAppCheck(new GoogleAuthError('APP_CHECK', { kind: 'rejected', code: '403' }))).toEqual({
      kind: 'rejected',
      code: '403',
    });
    expect(signInErrorAppCheck(new GoogleAuthError('NETWORK'))).toBeUndefined();
    expect(signInErrorAppCheck(new Error('boom'))).toBeUndefined();
  });
});

describe('sessionReasonMessageKey', () => {
  test('connecting says so on either platform', () => {
    expect(sessionReasonMessageKey('connecting', 'ios')).toBe('auth.sessionConnecting');
    expect(sessionReasonMessageKey('connecting', 'android')).toBe('auth.sessionConnecting');
  });

  test('an unavailable session is told what to update on its platform', () => {
    expect(sessionReasonMessageKey('unavailable', 'android')).toBe('auth.sessionUnavailableAndroid');
    expect(sessionReasonMessageKey('unavailable', 'ios')).toBe('auth.sessionUnavailableIos');
  });
});
