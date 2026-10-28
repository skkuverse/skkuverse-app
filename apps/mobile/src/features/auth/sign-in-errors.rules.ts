import type { AppCheckFailureKind, AppCheckProbe } from '@/platform/app-check.rules';

export type GoogleSignInErrorCode =
  | 'DOMAIN_NOT_ALLOWED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PLAY_SERVICES_UNAVAILABLE'
  | 'NETWORK'
  | 'TOO_MANY_REQUESTS'
  | 'ACCOUNT_UNAVAILABLE'
  | 'APP_CHECK'
  | 'APP_CHECK_THROTTLED'
  | 'DEVICE_UNSUPPORTED'
  | 'UNKNOWN';

export interface SignInAppCheck {
  kind: AppCheckFailureKind | 'bounded';
  code?: string;
}

export class GoogleAuthError extends Error {
  code: GoogleSignInErrorCode;
  appCheck?: SignInAppCheck;

  constructor(code: GoogleSignInErrorCode, appCheck?: SignInAppCheck) {
    super(code);
    this.code = code;
    this.name = 'GoogleAuthError';
    if (appCheck) this.appCheck = appCheck;
  }
}

export type AuthFailureClass = 'network' | 'app_check' | 'quota' | 'user_cancel' | 'fatal' | 'transient';

/** WHY: the anonymous path never has a sheet to cancel. */
export type AnonFailureClass = Exclude<AuthFailureClass, 'user_cancel'>;

export interface AnonFailure {
  cls: AnonFailureClass;
  acKind?: AppCheckFailureKind | 'bounded';
  code?: string;
}

// QUIRK(google-signin): Android's SIGN_IN_CURRENTLY_IN_PROGRESS arrives raw, not as IN_PROGRESS.
const GOOGLE_IN_PROGRESS_CODES = new Set(['12502']);

export type NativeStatusCodes = {
  SIGN_IN_CANCELLED: string;
  IN_PROGRESS: string;
  PLAY_SERVICES_NOT_AVAILABLE: string;
};

// QUIRK(google-signin): '7' is Android's CommonStatusCodes.NETWORK_ERROR; the negative iOS NSURLError
// codes come only from the profile fetch, since iOS reports AppAuth's network error as -5, a cancel.
const GOOGLE_NETWORK_CODES = new Set(['7', '-1001', '-1003', '-1004', '-1005', '-1009', '-1020']);

// QUIRK(firebase): an Android failure that is not a FirebaseNetworkException arrives as `auth/unknown`,
// so some offline sign-ins still read as UNKNOWN.
const FIREBASE_NETWORK_CODE = 'auth/network-request-failed';
const FIREBASE_QUOTA_CODES = new Set(['auth/too-many-requests', 'auth/quota-exceeded']);
// QUIRK(firebase): the code documented for a refused token, and the text iOS puts in
// `auth/internal-error` (17999) instead.
const APP_CHECK_INVALID_CODE = 'auth/firebase-app-check-token-is-invalid';
const APP_CHECK_INVALID_TEXT = /App Check token is invalid/i;

const FIREBASE_CODES: Record<string, { code: GoogleSignInErrorCode; report: boolean }> = {
  // WHY: reported on purpose: this is the row that says a quota is biting.
  'auth/too-many-requests': { code: 'TOO_MANY_REQUESTS', report: true },
  'auth/quota-exceeded': { code: 'TOO_MANY_REQUESTS', report: true },
  'auth/user-disabled': { code: 'ACCOUNT_UNAVAILABLE', report: true },
  'auth/account-exists-with-different-credential': { code: 'ACCOUNT_UNAVAILABLE', report: true },
};

function codeOf(err: unknown): string | null {
  if (typeof err !== 'object' || err === null || !('code' in err)) return null;
  const code = (err as { code: unknown }).code;
  return code == null ? null : String(code);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) return String((err as { message: unknown }).message);
  return '';
}

function isAppCheckRefusal(code: string, err: unknown): boolean {
  return code === APP_CHECK_INVALID_CODE || APP_CHECK_INVALID_TEXT.test(messageOf(err));
}

function probeClass(kind: AppCheckFailureKind | 'bounded'): AnonFailureClass {
  return kind === 'network' || kind === 'bounded' ? 'network' : 'app_check';
}

function appCheckOf(probe: Exclude<AppCheckProbe, { ok: true }>): SignInAppCheck {
  return { kind: probe.kind, ...(probe.code !== undefined && { code: probe.code }) };
}

export function appCheckSignInCode(kind: AppCheckFailureKind | 'bounded'): GoogleSignInErrorCode {
  switch (kind) {
    case 'network':
    case 'bounded':
      return 'NETWORK';
    case 'throttled':
      return 'APP_CHECK_THROTTLED';
    case 'unsupported':
      return 'DEVICE_UNSUPPORTED';
    case 'backoff':
    case 'rejected':
    case 'other':
      return 'APP_CHECK';
  }
}

export interface SignInClassification {
  code: GoogleSignInErrorCode;
  /** WHY: a dismissed sheet, a double tap or a dead network is the student's situation, not a defect. */
  report: boolean;
  appCheck?: SignInAppCheck;
}

/** QUIRK(firebase): under App Check enforcement a failed probe is what Auth answers, so it makes the failure App Check's. */
export function classifySignInError(
  err: unknown,
  statusCodes: NativeStatusCodes,
  probe?: AppCheckProbe | null,
): SignInClassification {
  if (err instanceof GoogleAuthError) {
    return { code: err.code, report: err.code === 'UNKNOWN', ...(err.appCheck && { appCheck: err.appCheck }) };
  }
  const code = codeOf(err);
  if (code === null) return { code: 'UNKNOWN', report: true };
  if (code === statusCodes.SIGN_IN_CANCELLED) return { code: 'CANCELLED', report: false };
  if (code === statusCodes.IN_PROGRESS || GOOGLE_IN_PROGRESS_CODES.has(code)) {
    return { code: 'IN_PROGRESS', report: false };
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return { code: 'PLAY_SERVICES_UNAVAILABLE', report: false };
  }
  if (GOOGLE_NETWORK_CODES.has(code) || code === FIREBASE_NETWORK_CODE) return { code: 'NETWORK', report: false };
  if (isAppCheckRefusal(code, err)) {
    return { code: 'APP_CHECK', report: true, ...(probe && !probe.ok && { appCheck: appCheckOf(probe) }) };
  }
  if (probe && !probe.ok) {
    const signInCode = appCheckSignInCode(probe.kind);
    return { code: signInCode, report: signInCode !== 'NETWORK', appCheck: appCheckOf(probe) };
  }
  return FIREBASE_CODES[code] ?? { code: 'UNKNOWN', report: true };
}

export function classifyAnonFailure(error: unknown, probe: AppCheckProbe | null): AnonFailure {
  if (probe && !probe.ok) {
    return { cls: probeClass(probe.kind), acKind: probe.kind, ...(probe.code !== undefined && { code: probe.code }) };
  }
  const code = codeOf(error);
  if (code === null) return { cls: 'transient' };
  if (code === FIREBASE_NETWORK_CODE) return { cls: 'network', code };
  if (isAppCheckRefusal(code, error)) return { cls: 'app_check', code };
  if (FIREBASE_QUOTA_CODES.has(code)) return { cls: 'quota', code };
  if (code === 'auth/operation-not-allowed') return { cls: 'fatal', code };
  return { cls: 'transient', code };
}

export function signInErrorClass(code: GoogleSignInErrorCode): AuthFailureClass {
  switch (code) {
    case 'NETWORK':
      return 'network';
    case 'APP_CHECK':
    case 'APP_CHECK_THROTTLED':
    case 'DEVICE_UNSUPPORTED':
      return 'app_check';
    case 'TOO_MANY_REQUESTS':
      return 'quota';
    case 'CANCELLED':
    case 'IN_PROGRESS':
      return 'user_cancel';
    case 'DOMAIN_NOT_ALLOWED':
    case 'ACCOUNT_UNAVAILABLE':
    case 'PLAY_SERVICES_UNAVAILABLE':
      return 'fatal';
    case 'UNKNOWN':
      return 'transient';
  }
}

const SIGN_IN_INSTEAD_OF_LINK = new Set([
  // WHY: a returning student whose reinstall or sign-out left a fresh anonymous user; signing into
  // their account is the intended outcome.
  'auth/credential-already-in-use',
  'auth/email-already-in-use',
  // WHY: the anonymous user is gone or unusable on the server, so a plain sign-in loses nothing, and
  // refusing would leave the dead user in place and fail every retry.
  'auth/user-not-found',
  'auth/user-disabled',
  'auth/user-token-expired',
  'auth/invalid-user-token',
]);

// WHY: any other failure, offline above all, must not fall through: a sign-in that then succeeds for
// a Google identity with no account mints a new uid and abandons a live anonymous one.
export function shouldSignInInsteadOfLink(err: unknown): boolean {
  const code = codeOf(err);
  return code !== null && SIGN_IN_INSTEAD_OF_LINK.has(code);
}

export type SignInErrorMessageKey =
  | 'auth.domainNotAllowed'
  | 'auth.playServicesError'
  | 'auth.networkError'
  | 'auth.tooManyRequests'
  | 'auth.accountUnavailable'
  | 'auth.appCheckError'
  | 'auth.appCheckThrottled'
  | 'auth.deviceUnsupportedAndroid'
  | 'auth.deviceUnsupportedIos'
  | 'auth.unknownError';

// WHY: the button stays enabled for every code, since Play services may be updated meanwhile. The
// device-unsupported fix is Play services on Android and the app itself on iOS.
export function signInErrorMessageKey(code: GoogleSignInErrorCode, os: 'ios' | 'android'): SignInErrorMessageKey | null {
  switch (code) {
    case 'CANCELLED':
    case 'IN_PROGRESS':
      return null;
    case 'DOMAIN_NOT_ALLOWED':
      return 'auth.domainNotAllowed';
    case 'PLAY_SERVICES_UNAVAILABLE':
      return 'auth.playServicesError';
    case 'NETWORK':
      return 'auth.networkError';
    case 'TOO_MANY_REQUESTS':
      return 'auth.tooManyRequests';
    case 'ACCOUNT_UNAVAILABLE':
      return 'auth.accountUnavailable';
    case 'APP_CHECK':
      return 'auth.appCheckError';
    case 'APP_CHECK_THROTTLED':
      return 'auth.appCheckThrottled';
    case 'DEVICE_UNSUPPORTED':
      return os === 'android' ? 'auth.deviceUnsupportedAndroid' : 'auth.deviceUnsupportedIos';
    case 'UNKNOWN':
      return 'auth.unknownError';
  }
}

export function signInErrorCode(err: unknown): GoogleSignInErrorCode {
  return err instanceof GoogleAuthError ? err.code : 'UNKNOWN';
}

export function signInErrorAppCheck(err: unknown): SignInAppCheck | undefined {
  return err instanceof GoogleAuthError ? err.appCheck : undefined;
}

export type SessionReasonMessageKey =
  | 'auth.sessionConnecting'
  | 'auth.sessionUnavailableAndroid'
  | 'auth.sessionUnavailableIos';

export function sessionReasonMessageKey(reason: 'connecting' | 'unavailable', os: 'ios' | 'android'): SessionReasonMessageKey {
  if (reason === 'connecting') return 'auth.sessionConnecting';
  return os === 'android' ? 'auth.sessionUnavailableAndroid' : 'auth.sessionUnavailableIos';
}
