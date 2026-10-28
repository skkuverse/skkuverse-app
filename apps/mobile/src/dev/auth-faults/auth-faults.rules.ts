// EVIDENCE: the messages below are the ones recorded from iOS 3.6.2 Crashlytics and Play Integrity,
// so the classifiers take the same branches a device takes under App Check enforcement.

export type AuthFaultTarget = 'signIn' | 'signInWithGoogle' | 'probe';

// QUIRK(firebase): on an Auth call iOS reports a refused App Check token as a generic `auth/internal-error` whose message alone names App Check.
export type AuthFaultShape = 'appCheckInvalid' | 'throttled' | 'network';

export const AUTH_FAULT_TARGETS: readonly AuthFaultTarget[] = ['signIn', 'signInWithGoogle', 'probe'];
export const AUTH_FAULT_SHAPES: readonly AuthFaultShape[] = ['appCheckInvalid', 'throttled', 'network'];

const AUTH_ERRORS: Record<AuthFaultShape, { code: string; message: string }> = {
  appCheckInvalid: {
    code: 'auth/internal-error',
    message:
      '[auth/internal-error] An internal error has occurred, print and inspect the error details for more information. Firebase App Check token is invalid.',
  },
  throttled: {
    code: 'auth/too-many-requests',
    message:
      '[auth/too-many-requests] We have blocked all requests from this device due to unusual activity. Try again later.',
  },
  network: {
    code: 'auth/network-request-failed',
    message:
      '[auth/network-request-failed] Network error (such as timeout, interrupted connection or unreachable host) has occurred.',
  },
};

const PROBE_ERRORS: Record<AuthFaultShape, string> = {
  appCheckInvalid:
    '[appCheck/token-error] The operation couldn’t be completed. The server responded with an error: - URL: https://firebaseappcheck.googleapis.com/v1/projects/p/apps/a:exchangeDebugToken - HTTP status code: 403 - Response body: {"error":{"code":403,"message":"App attestation failed.","status":"PERMISSION_DENIED"}}',
  throttled:
    '[appCheck/token-error] com.google.android.play.core.integrity.IntegrityServiceException: -8: The calling app is making too many requests to the API.',
  network:
    '[appCheck/token-error] java.net.UnknownHostException: Unable to resolve host "firebaseappcheck.googleapis.com": No address associated with hostname',
};

// QUIRK(firebase): an Auth error carries a `code`, a probe error only its message.
export function authFaultError(target: AuthFaultTarget, shape: AuthFaultShape): Error {
  if (target === 'probe') return new Error(PROBE_ERRORS[shape]);
  const { code, message } = AUTH_ERRORS[shape];
  return Object.assign(new Error(message), { code });
}
